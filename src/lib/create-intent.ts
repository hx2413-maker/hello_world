export type CreateIntent = { scene?: string; tone?: string; template?: string; prompt?: "today" };

export function readCreateIntent(query: Record<string, unknown>): CreateIntent {
  const intent: CreateIntent = {};
  if (query.prompt === "today") intent.prompt = "today";
  if (typeof query.scene === "string" && query.scene.trim().length >= 10 && query.scene.trim().length <= 280 && !/[\u0000-\u001f\u007f]/.test(query.scene)) intent.scene = query.scene.trim();
  if (query.tone === "witty" || query.tone === "poetic" || query.tone === "deadpan") intent.tone = query.tone;
  if (typeof query.template === "string" && /^[1-9][0-9]{0,14}$/.test(query.template)) intent.template = query.template;
  return intent;
}

export function createIntentUrl(intent: CreateIntent): string {
  const query = new URLSearchParams();
  if (intent.prompt) query.set("prompt", intent.prompt);
  if (intent.scene) query.set("scene", intent.scene);
  if (intent.tone) query.set("tone", intent.tone);
  if (intent.template) query.set("template", intent.template);
  return `/create${query.size ? `?${query.toString()}` : ""}`;
}
