import "server-only";

type AuthOriginOptions = {
  requestUrl?: string;
  verifyRequestOrigin?: boolean;
};

export function getAuthOrigin(
  requestHeaders: Pick<Headers, "get">,
  { requestUrl, verifyRequestOrigin = false }: AuthOriginOptions = {},
): string {
  const configuredOrigins = [
    process.env.SITE_URL,
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
    process.env.VERCEL_PROJECT_PRODUCTION_URL &&
      `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
    process.env.VERCEL_BRANCH_URL && `https://${process.env.VERCEL_BRANCH_URL}`,
  ].filter((value): value is string => Boolean(value));
  const allowedOrigins = new Set(
    configuredOrigins.map((value) => new URL(value).origin),
  );

  // Next.js may normalize request.url to localhost during development. Behind
  // Vercel's proxy it can also differ from the address that owns the cookies.
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "development" ? "http" : "https");

  try {
    const candidate = host
      ? new URL(`${protocol}://${host}`)
      : requestUrl
        ? new URL(requestUrl)
        : null;

    if (
      !candidate ||
      !["http:", "https:"].includes(candidate.protocol) ||
      candidate.username ||
      candidate.password ||
      (host && (candidate.pathname !== "/" || candidate.search || candidate.hash))
    ) {
      throw new Error("Invalid request origin.");
    }

    const isLocalDevelopment =
      process.env.NODE_ENV === "development" &&
      candidate.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(candidate.hostname);

    if (!allowedOrigins.has(candidate.origin) && !isLocalDevelopment) {
      throw new Error("Untrusted request origin.");
    }

    const browserOrigin = requestHeaders.get("origin");
    if (verifyRequestOrigin && browserOrigin) {
      const parsedOrigin = new URL(browserOrigin);
      if (parsedOrigin.origin !== candidate.origin) {
        throw new Error("Sign-in must start on the callback's origin.");
      }
    }

    return candidate.origin;
  } catch {
    throw new Error("This site's sign-in URL has not been configured.");
  }
}
