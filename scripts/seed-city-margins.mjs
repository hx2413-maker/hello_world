// Trusted, manual setup only: node --env-file=.env.local scripts/seed-city-margins.mjs
// Generates real AI examples under a separate, explicitly labeled starter account.
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { buildPrompt, parseGeminiResponse, SYSTEM_PROMPT } from "../src/lib/generation-contract.ts";

const starterId = "1e3325aa-b52e-4bf0-afef-3ad4bbf6fe7d";
const email = "city-margins-starter@example.invalid";
const scenes = [
  { vibe: "witty", scene: "A Midwesterner on their first week at Columbia tries to greet every stranger on Broadway." },
  { vibe: "poetic", scene: "Reading a secondhand novel beside the Hudson at sunset, with a bagel and nowhere else to be." },
  { vibe: "deadpan", scene: "Taking the 1 train to explore downtown and missing the stop because the book finally got good." },
];
const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anonKey, SUPABASE_SERVICE_ROLE_KEY: serviceKey, GEMINI_API_KEY: apiKey } = process.env;
const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
if (!url || !anonKey || !serviceKey || !apiKey) throw new Error("Missing required server configuration.");
if (!/^[a-zA-Z0-9.-]+$/.test(model)) throw new Error("Invalid model name.");
const options = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } };
const admin = createClient(url, serviceKey, options);
const member = createClient(url, anonKey, options);
const checked = (result, operation) => {
  if (result.error) throw new Error(`${operation} failed (${result.error.code || result.error.status || "database"}).`);
  return result.data;
};

const lookup = await admin.auth.admin.getUserById(starterId);
if (lookup.error && lookup.error.status !== 404) throw new Error("Starter account lookup failed.");
const password = randomBytes(48).toString("base64url");
if (lookup.data.user) {
  if (lookup.data.user.email !== email || lookup.data.user.app_metadata.city_margins_starter !== true) {
    throw new Error("Starter ID belongs to an unexpected account; no changes made.");
  }
  checked(await admin.auth.admin.updateUserById(starterId, { password }), "Starter account session setup");
} else {
  checked(await admin.auth.admin.createUser({
    id: starterId, email, password, email_confirm: true,
    app_metadata: { city_margins_starter: true },
  }), "Starter account creation");
}
checked(await member.auth.signInWithPassword({ email, password }), "Starter sign-in");

try {
  for (const { scene, vibe } of scenes) {
    const existing = checked(await member.from("generation_requests").select("id,status")
      .eq("scene", scene).eq("status", "completed").limit(1), "Existing example lookup");
    if (existing.length) {
      console.log(`Already published: /margins/${existing[0].id}`);
      continue;
    }
    const prompt = buildPrompt(scene, vibe);
    const requestId = checked(await member.rpc("reserve_generation", {
      p_scene: scene, p_vibe: vibe, p_prompt: prompt, p_system_prompt: SYSTEM_PROMPT, p_model: model,
    }), "Generation reservation");
    let output;
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 256, temperature: 0.9, candidateCount: 1 },
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}.`);
      output = parseGeminiResponse(await response.json());
    } catch (error) {
      await admin.rpc("fail_generation", { p_request_id: requestId });
      throw error;
    }
    let saved = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await admin.rpc("complete_generation", {
        p_request_id: requestId, p_caption: output.body,
        p_input_tokens: output.inputTokens, p_output_tokens: output.outputTokens,
      });
      if (!result.error && result.data === requestId) { saved = true; break; }
    }
    if (!saved) throw new Error("Could not confirm saved caption; inspect its reservation before retrying.");
    // The database assigns the starter label atomically during publication,
    // based on this account's trusted app_metadata flag.
    console.log(`Published: /margins/${requestId}`);
  }
} finally {
  await member.auth.signOut();
}
