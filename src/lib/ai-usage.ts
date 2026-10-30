import "server-only";
import { createClient } from "@supabase/supabase-js";
export { isSameOrigin } from "@/lib/request-origin";

export function getDemoSecret() {
  const secret = process.env.CAMPUS_GUEST_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

// A separate, deliberately narrow server capability. This client never publishes
// captions, casts votes, accesses member profiles, or creates anonymous accounts.
export function createAiUsageWriter() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8_000) }) },
  });
  return {
    async reserveAssistant(userId: string) {
      return client.rpc("reserve_campus_assistant", { p_user_id: userId });
    },
    async demoStatus(guestHash: string) {
      return client.rpc("campus_demo_used", { p_guest_hash: guestHash });
    },
    async demoAvailability(guestHash: string, ipHash: string) {
      return client.rpc("check_campus_demo", { p_guest_hash: guestHash, p_ip_hash: ipHash });
    },
    async reserveDemo(guestHash: string, ipHash: string, prompt: string, systemPrompt: string, model: string) {
      return client.rpc("reserve_campus_demo", { p_guest_hash: guestHash, p_ip_hash: ipHash, p_prompt: prompt, p_system_prompt: systemPrompt, p_model: model });
    },
    async finishDemo(id: string, caption: string | null) {
      return client.rpc("finish_campus_demo", { p_request_id: id, p_caption: caption });
    },
  };
}

export async function readBoundedBody(request: Request, limit: number): Promise<Uint8Array> {
  if (!request.body) throw new Error("missing_body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); throw new Error("body_too_large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
