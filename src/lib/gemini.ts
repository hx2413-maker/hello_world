import "server-only";
import { parseGeminiResponse, SYSTEM_PROMPT } from "@/lib/generation-contract";

export function getGenerationConfig() {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  if (!apiKey || !/^[a-zA-Z0-9.-]+$/.test(model)) return null;
  return { apiKey, model };
}

export async function generateWithGemini(prompt: string, config: { apiKey: string; model: string }, frames: Buffer[] = []) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": config.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [
          ...frames.map((image) => ({ inlineData: { mimeType: "image/webp", data: image.toString("base64") } })),
          { text: prompt },
        ] }],
        generationConfig: { maxOutputTokens: 256, temperature: 0.9, candidateCount: 1 },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    },
  );
  // Never log provider response bodies: they can contain prompts or credentials.
  if (!response.ok) {
    const reason = [401, 402, 403, 404].includes(response.status)
      ? "provider_unavailable"
      : response.status === 429 ? "provider_busy" : "provider_error";
    throw new Error(reason);
  }
  return parseGeminiResponse(await response.json());
}
