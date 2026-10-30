export const AUTH_NEXT_COOKIE = "city-margins-auth-next";
export const AUTH_NEXT_MAX_AGE = 10 * 60;

// Keep return destinations deliberately narrow. Do not normalize or decode:
// protocol-relative URLs, encoded separators, arbitrary queries and fragments stay invalid.
// Creation drafts admit only a bounded scene, a built-in tone, or a numeric template ID.
export function getSafeAuthNext(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value === "/margins" || value === "/profile" || value === "/create" || value === "/create?prompt=today") return value;
  if (value === "/demo" || value === "/templates") return value;
  if (value.startsWith("/create?") && value.length <= 3600 && !/[#\\\u0000-\u0020\u007f]/.test(value)) {
    const params = new URLSearchParams(value.slice(8));
    const keys = Array.from(params.keys());
    if (!keys.length || new Set(keys).size !== keys.length || keys.some((key) => !["scene", "tone", "template", "prompt"].includes(key))) return null;
    if (params.has("prompt") && !value.slice(8).split("&").includes("prompt=today")) return null;
    const scene = params.get("scene");
    const tone = params.get("tone");
    const template = params.get("template");
    if (scene !== null && (scene.trim().length < 10 || scene.trim().length > 280 || /[\u0000-\u001f\u007f]/.test(scene))) return null;
    if (tone !== null && !["witty", "poetic", "deadpan"].includes(tone)) return null;
    if (template !== null && !/^[1-9][0-9]{0,14}$/.test(template)) return null;
    return value;
  }
  const captionPrefix = "/margins/";
  if (!value.startsWith(captionPrefix) || value.length !== captionPrefix.length + 36) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.slice(captionPrefix.length)) ? value : null;
}

export function getPostSignInPath(next: unknown): string {
  return getSafeAuthNext(next) ?? "/margins";
}
