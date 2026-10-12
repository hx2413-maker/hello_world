export const AUTH_NEXT_COOKIE = "city-margins-auth-next";
export const AUTH_NEXT_MAX_AGE = 10 * 60;

// Keep return destinations deliberately narrow. Do not normalize or decode:
// protocol-relative URLs, encoded separators, queries and fragments stay invalid.
export function getSafeAuthNext(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value === "/margins") return value;
  const captionPrefix = "/margins/";
  if (!value.startsWith(captionPrefix) || value.length !== captionPrefix.length + 36) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.slice(captionPrefix.length)) ? value : null;
}

export function getPostSignInPath(next: unknown): string {
  return getSafeAuthNext(next) ?? "/margins";
}
