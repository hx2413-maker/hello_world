export type TonePreference = { name: string; instructions: string };
export type SharedTone = TonePreference & { id: string; user_id: string; created_at: string };
export type ToneState = { status: "idle" | "error" | "success"; message?: string; tone?: SharedTone };

export const BUILT_IN_TONES = [
  { name: "witty", label: "Witty", instructions: "A concise, playful observation with an unexpected punchline." },
  { name: "poetic", label: "Poetic", instructions: "Lyrical, imaginative phrasing with a funny campus-life twist." },
  { name: "deadpan", label: "Deadpan", instructions: "Dry, understated humor delivered with a completely straight face." },
] as const;

export function validateTone(name: unknown, instructions: unknown): TonePreference | null {
  if (typeof name !== "string" || typeof instructions !== "string") return null;
  const cleanName = name.trim();
  const cleanInstructions = instructions.trim();
  if (cleanName.length < 2 || cleanName.length > 40 || /[\p{Cc}\p{Cf}]/u.test(cleanName)) return null;
  if (cleanInstructions.length < 10 || cleanInstructions.length > 400 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(cleanInstructions)) return null;
  return { name: cleanName, instructions: cleanInstructions };
}
