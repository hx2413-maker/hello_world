export type MemeTemplate = { id: string; name: string; url: string; width: number; height: number };
export type CampusStory = { title: string; url: string; publishedAt: string; category: string };

export function plainSourceText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  const entities: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  return value.replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (_, entity: string) => {
      if (!entity.startsWith("#")) return entities[entity.toLowerCase()] ?? "";
      const code = entity.toLowerCase().startsWith("#x") ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : "";
    })
    .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, " ")
    .replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function safeTemplateUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "i.imgflip.com" && !url.port && !url.username && !url.password
      && !url.search && !url.hash && /^\/[a-z0-9]{1,32}\.(?:jpe?g|png|webp|gif)$/i.test(url.pathname) ? url.href : null;
  } catch { return null; }
}

export function parseMemeTemplates(value: unknown): MemeTemplate[] {
  if (!value || typeof value !== "object" || !("success" in value) || value.success !== true || !("data" in value)) return [];
  const data = value.data;
  if (!data || typeof data !== "object" || !("memes" in data) || !Array.isArray(data.memes)) return [];
  const seen = new Set<string>();
  return data.memes.slice(0, 200).flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    const id = typeof raw.id === "string" && /^\d{1,15}$/.test(raw.id) ? raw.id : null;
    const name = plainSourceText(raw.name, 100);
    const url = safeTemplateUrl(raw.url);
    const width = typeof raw.width === "number" ? raw.width : 0;
    const height = typeof raw.height === "number" ? raw.height : 0;
    if (!id || seen.has(id) || !name || !url || !Number.isInteger(width) || !Number.isInteger(height)
      || width < 1 || height < 1 || width > 10000 || height > 10000 || width * height > 20_000_000) return [];
    seen.add(id);
    return [{ id, name, url, width, height }];
  }).slice(0, 100);
}

export function safeCampusNewsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value, "https://news.columbia.edu");
    if (url.protocol !== "https:" || url.hostname !== "news.columbia.edu" || url.port || url.username || url.password
      || !/^\/(news|content)\/[a-z0-9-]+\/?$/i.test(url.pathname)) return null;
    url.search = "";
    url.hash = "";
    return url.href;
  } catch { return null; }
}

export function parseCampusNews(html: string, now = new Date()): CampusStory[] {
  // Columbia publishes this JSON array for its news highlights. Parse data only;
  // never run the surrounding script or interpret article text as instructions.
  const match = html.match(/\b(?:var|let|const)\s+highlights_data\s*=\s*(\[[\s\S]*?\]);/);
  let data: unknown = [];
  if (match && match[1].length <= 300_000) {
    try { data = JSON.parse(match[1]); } catch { /* Try the dated article teasers below. */ }
  }
  if (!Array.isArray(data)) data = [];
  const seen = new Set<string>();
  const stories = (data as unknown[]).slice(0, 100).flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    const title = plainSourceText(raw.label, 160);
    const url = safeCampusNewsUrl(raw.link);
    const timestamp = Number(raw.dateStart) * 1000;
    // Ignore future, undated, or old stories rather than calling them current.
    if (!title || !url || seen.has(url) || !Number.isFinite(timestamp)
      || timestamp > now.getTime() + 3_600_000 || timestamp < now.getTime() - 21 * 86_400_000) return [];
    seen.add(url);
    return [{ title, url, publishedAt: new Date(timestamp).toISOString(), category: plainSourceText(raw.category, 60) }];
  });
  // The same official homepage also exposes dated schema:Article teasers.
  // Keep this independent of its JavaScript highlight format so a CMS change
  // does not hide otherwise available recent campus news.
  const articlePattern = /<article\b[^>]*\btypeof=["']schema:Article["'][^>]*>([\s\S]*?)<\/article>/gi;
  for (const article of html.matchAll(articlePattern)) {
    const content = article[1];
    const href = content.match(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']bookmark["']/i)?.[1];
    const rawTitle = content.match(/<span\b[^>]*\bproperty=["']schema:name["'][^>]*>([\s\S]*?)<\/span>/i)?.[1];
    const rawDate = content.match(/<div\b[^>]*class=["'][^"']*field--name-field-cu-date[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1];
    const url = safeCampusNewsUrl(href);
    const title = plainSourceText(rawTitle, 160);
    const date = plainSourceText(rawDate, 60);
    // Teasers publish a calendar date, not a time. Noon UTC keeps the displayed
    // date stable in New York and does not depend on the server's time zone.
    const timestamp = /^[A-Za-z]+ \d{1,2}, \d{4}$/.test(date) ? Date.parse(`${date} 12:00:00 GMT`) : NaN;
    if (!title || !url || seen.has(url) || !Number.isFinite(timestamp)
      || timestamp > now.getTime() + 3_600_000 || timestamp < now.getTime() - 21 * 86_400_000) continue;
    seen.add(url);
    stories.push({ title, url, publishedAt: new Date(timestamp).toISOString(), category: "Campus News" });
  }
  return stories.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 100);
}

export async function readBoundedBody(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > maxBytes) {
    await response.body?.cancel();
    throw new Error("Content exceeds the size limit.");
  }
  if (!response.body) throw new Error("Empty content response.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error("Content exceeds the size limit.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}

export function imageMimeFromBytes(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return "image/png";
  const header = new TextDecoder("ascii").decode(bytes.slice(0, 12));
  if (header.startsWith("GIF87a") || header.startsWith("GIF89a")) return "image/gif";
  if (header.startsWith("RIFF") && header.slice(8, 12) === "WEBP") return "image/webp";
  return null;
}

export function sourceFetchedAt(response: Response): string | null {
  const date = Date.parse(response.headers.get("date") ?? "");
  return Number.isFinite(date) ? new Date(date).toISOString() : null;
}
