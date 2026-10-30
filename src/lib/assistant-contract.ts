export const ASSISTANT_DESTINATIONS = ["feed", "top", "create", "templates", "demo", "profile"] as const;
export type AssistantDestination = (typeof ASSISTANT_DESTINATIONS)[number];
export type AssistantTone = "witty" | "poetic" | "deadpan";
export type AssistantAction =
  | { kind: "navigate"; label: string; href: string }
  | { kind: "generate"; scene: string; tone: AssistantTone; href: string };
export type AssistantMessage = { role: "user" | "assistant"; content: string };

/** Tool actions describe available next steps; no navigation/publication occurs
 * until the user clicks. Keep that status truthful regardless of model wording.
 */
export function assistantReplyText(modelText: string, actions: AssistantAction[]): string {
  if (actions.some((action) => action.kind === "generate")) {
    return "Here’s a campus meme idea. Review it, then choose Generate & publish, or edit it in the studio.";
  }
  if (actions.length) return "Choose a link below to open that page.";
  return modelText.trim().slice(0, 600) || "Tell me what you’d like to do on campus today.";
}

export function parseAssistantMessages(value: unknown): AssistantMessage[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) return null;
  const messages: AssistantMessage[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || !["user", "assistant"].includes(item.role)
      || typeof item.content !== "string" || !item.content.trim() || item.content.length > 600) return null;
    messages.push({ role: item.role, content: item.content.trim() });
  }
  return messages.at(-1)?.role === "user" ? messages : null;
}

export function navigationAction(destination: unknown, userId: string): AssistantAction | null {
  if (typeof destination !== "string" || !ASSISTANT_DESTINATIONS.includes(destination as AssistantDestination)) return null;
  const destinations: Record<AssistantDestination, { label: string; href: string }> = {
    feed: { label: "Open the feed", href: "/margins" },
    top: { label: "See top memes", href: "/margins?sort=top" },
    create: { label: "Open the studio", href: "/create" },
    templates: { label: "Browse meme images", href: "/templates" },
    demo: { label: "Try the practice page", href: "/demo" },
    profile: { label: "Open my profile", href: `/members/${userId}` },
  };
  if (!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(userId)) return null;
  return { kind: "navigate", ...destinations[destination as AssistantDestination] };
}

export function memeAction(scene: unknown, tone: unknown): Extract<AssistantAction, { kind: "generate" }> | null {
  if (typeof scene !== "string" || scene.trim().length < 10 || scene.trim().length > 280
    || (tone !== "witty" && tone !== "poetic" && tone !== "deadpan")) return null;
  const query = new URLSearchParams({ scene: scene.trim(), tone });
  return { kind: "generate", scene: scene.trim(), tone, href: `/create?${query}` };
}
