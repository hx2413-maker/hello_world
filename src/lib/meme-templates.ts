import "server-only";
import { imageMimeFromBytes, parseMemeTemplates, readBoundedBody, safeTemplateUrl, sourceFetchedAt, type MemeTemplate } from "./content-sources";

export type { MemeTemplate } from "./content-sources";
export const TEMPLATE_CACHE_TAG = "campus-meme-templates";
export type MemeTemplateCatalog = { templates: MemeTemplate[]; fetchedAt: string | null; status: "available" | "unavailable" };

export async function getMemeTemplates(): Promise<MemeTemplateCatalog> {
  try {
    const response = await fetch("https://api.imgflip.com/get_memes", {
      cache: "force-cache", next: { revalidate: 7 * 86_400, tags: [TEMPLATE_CACHE_TAG] },
      signal: AbortSignal.timeout(5000), redirect: "error", headers: { Accept: "application/json" },
    });
    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("Template source unavailable.");
    const body = await readBoundedBody(response, 300_000);
    const templates = parseMemeTemplates(JSON.parse(new TextDecoder().decode(body)));
    if (!templates.length) throw new Error("No valid templates returned.");
    return { templates, fetchedAt: sourceFetchedAt(response), status: "available" };
  } catch {
    return { templates: [], fetchedAt: null, status: "unavailable" };
  }
}

export async function getMemeTemplate(id: string): Promise<MemeTemplate | null> {
  if (!/^\d{1,15}$/.test(id)) return null;
  return (await getMemeTemplates()).templates.find((item) => item.id === id) ?? null;
}

export async function getTemplateUpload(id: string): Promise<File | null> {
  const template = await getMemeTemplate(id);
  if (!template || !safeTemplateUrl(template.url)) return null;
  try {
    const response = await fetch(template.url, {
      cache: "no-store", signal: AbortSignal.timeout(7000), redirect: "error",
      headers: { Accept: "image/jpeg,image/png,image/webp,image/gif" },
    });
    if (!response.ok) return null;
    const mime = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (!mime || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) { await response.body?.cancel(); return null; }
    const bytes = await readBoundedBody(response, 2 * 1024 * 1024);
    if (imageMimeFromBytes(bytes) !== mime) return null;
    // The generation path still decodes and sanitizes this with prepareMemeUpload.
    return new File([new Uint8Array(bytes)], `template-${id}.${mime.split("/")[1]}`, { type: mime });
  } catch { return null; }
}
