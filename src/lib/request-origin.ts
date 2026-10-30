/** Validate browser mutation origins against the HTTP authority actually used.
 * Next may canonicalize Request.url's hostname (for example 127.0.0.1 to
 * localhost), so its protocol and the request's Host header are authoritative.
 * Forwarded-host headers are deliberately ignored.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host || !/^[a-zA-Z0-9.:[\]-]+$/.test(host)) return false;
  try {
    const protocol = new URL(request.url).protocol;
    if (protocol !== "http:" && protocol !== "https:") return false;
    const authority = new URL(`${protocol}//${host}`);
    if (!authority.hostname || authority.username || authority.password) return false;
    // Exact serialized comparison also rejects null origins, paths, fragments,
    // userinfo, unexpected ports, and protocol downgrade attempts.
    return origin === authority.origin;
  } catch { return false; }
}
