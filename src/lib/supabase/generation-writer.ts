import "server-only";
import { createClient } from "@supabase/supabase-js";

// This privileged client is deliberately limited to generation completion RPCs.
// Reading data, reserving generations, and voting always use the user's session.
export function createGenerationWriter() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8_000) }) },
  });
  return {
    async complete(id: string, caption: string, inputTokens: number | null, outputTokens: number | null) {
      return client.rpc("complete_generation", {
        p_request_id: id, p_caption: caption, p_input_tokens: inputTokens, p_output_tokens: outputTokens,
      });
    },
    async fail(id: string) {
      return client.rpc("fail_generation", { p_request_id: id });
    },
  };
}
