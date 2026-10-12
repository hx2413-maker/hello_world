// Trusted, manual setup only: node --env-file=.env.local scripts/seed-city-margins.mjs [/absolute/image.jpg]
// Generates real AI examples under a separate, explicitly labeled starter account.
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { extname, isAbsolute } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { buildPrompt, parseGeminiResponse, SYSTEM_PROMPT } from "../src/lib/generation-contract.ts";
import { MAX_IMAGE_BYTES, normalizeMemeImage } from "../src/lib/meme-image.ts";

const arguments_ = process.argv.slice(2);
if (arguments_.length > 1 || (arguments_.length === 1 && !isAbsolute(arguments_[0]))) {
  throw new Error("Usage: node --env-file=.env.local scripts/seed-city-margins.mjs [/absolute/image.jpg]");
}
const imageFilePath = arguments_[0];
let image = null;
if (imageFilePath) {
  const mimeType = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }[extname(imageFilePath).toLowerCase()];
  const fileInfo = await stat(imageFilePath);
  if (!mimeType || !fileInfo.isFile() || fileInfo.size === 0 || fileInfo.size > MAX_IMAGE_BYTES) {
    throw new Error("Choose a nonempty JPEG, PNG, or WebP file no larger than 2 MiB.");
  }
  image = await normalizeMemeImage(new File([await readFile(imageFilePath)], "starter-upload", { type: mimeType }));
}

const starterId = "1e3325aa-b52e-4bf0-afef-3ad4bbf6fe7d";
const email = "city-margins-starter@example.invalid";
const scenes = image ? [{ vibe: "witty", scene: "Use the uploaded image as the scene." }] : [
  { vibe: "witty", scene: "A Midwesterner on their first week at Columbia tries to greet every stranger on Broadway." },
  { vibe: "poetic", scene: "Trying to look mysterious by the Hudson at sunset while the wind steals my bagel wrapper." },
  { vibe: "deadpan", scene: "Taking the 1 train to explore downtown and realizing I have been traveling toward the Bronx." },
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
    const prompt = buildPrompt(scene, vibe, Boolean(image));
    const imagePath = image ? `${starterId}/${randomUUID()}.webp` : null;
    const reservation = {
      p_scene: scene, p_vibe: vibe, p_prompt: prompt, p_system_prompt: SYSTEM_PROMPT, p_model: model,
    };
    const requestId = checked(imagePath
      ? await member.rpc("reserve_image_generation", { ...reservation, p_image_path: imagePath })
      : await member.rpc("reserve_generation", reservation), "Generation reservation");
    let output;
    try {
      if (image && imagePath) {
        // Storage RLS requires this exact quota-backed reservation before upload.
        checked(await member.storage.from("meme-images").upload(imagePath, image, {
          contentType: "image/webp", upsert: false,
        }), "Image upload");
      }
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [
            ...(image ? [{ inlineData: { mimeType: "image/webp", data: image.toString("base64") } }] : []),
            { text: prompt },
          ] }],
          generationConfig: { maxOutputTokens: 256, temperature: 0.9, candidateCount: 1 },
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}.`);
      output = parseGeminiResponse(await response.json());
    } catch (error) {
      await admin.rpc("fail_generation", { p_request_id: requestId }).catch(() => undefined);
      throw error;
    }
    let saved = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await admin.rpc("complete_generation", {
          p_request_id: requestId, p_caption: output.body,
          p_input_tokens: output.inputTokens, p_output_tokens: output.outputTokens,
        });
        if (!result.error && result.data === requestId) { saved = true; break; }
      } catch { /* Retry an interrupted completion without regenerating. */ }
    }
    if (!saved) throw new Error("Could not confirm saved caption; inspect its reservation before retrying.");
    // The database assigns the starter label atomically during publication,
    // based on this account's trusted app_metadata flag.
    console.log(`Published: /margins/${requestId}`);
  }
} finally {
  await member.auth.signOut();
}
