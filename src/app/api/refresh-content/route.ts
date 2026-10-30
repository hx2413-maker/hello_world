import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { CAMPUS_NEWS_CACHE_TAG, getCampusNewsResult } from "@/lib/campus-news";
import { getMemeTemplates, TEMPLATE_CACHE_TAG } from "@/lib/meme-templates";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const source = new URL(request.url).searchParams.get("source");
  if (source === "templates") {
    revalidateTag(TEMPLATE_CACHE_TAG, { expire: 0 });
    const result = await getMemeTemplates();
    return Response.json({ source, ok: result.status === "available", count: result.templates.length, fetchedAt: result.fetchedAt }, { status: result.status === "available" ? 200 : 502 });
  }
  if (source === "news") {
    revalidateTag(CAMPUS_NEWS_CACHE_TAG, { expire: 0 });
    const { prompt, diagnostics } = await getCampusNewsResult(10_000);
    return Response.json({ source, ok: prompt.kind === "news", kind: prompt.kind, fetchedAt: prompt.fetchedAt ?? null, diagnostics }, { status: prompt.kind === "news" ? 200 : 502, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ error: "Choose news or templates." }, { status: 400 });
}
