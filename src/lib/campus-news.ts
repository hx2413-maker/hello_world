import "server-only";
import { parseCampusNews, readBoundedBody, sourceFetchedAt } from "./content-sources";
import { getDailyPrompt } from "./margins-shared";

export const CAMPUS_NEWS_CACHE_TAG = "campus-news";
export type CampusPrompt = {
  label: string; scene: string; sourceTitle?: string; sourceUrl?: string;
  publishedAt?: string; fetchedAt?: string; kind: "news" | "holiday" | "fallback";
};

type NewsDiagnostics = {
  outcome: "ok" | "upstream_status" | "unexpected_type" | "no_recent_stories" | "no_campus_stories" | "timeout" | "fetch_error" | "invalid_content";
  upstreamStatus?: number; contentType?: string; fetchedAt?: string;
  bytes?: number; storyCount?: number; elapsedMs: number; errorCode?: string;
};

export async function getCampusNewsResult(timeoutMs = 3500): Promise<{ prompt: CampusPrompt; diagnostics: NewsDiagnostics }> {
  const started = Date.now();
  const diagnostics: NewsDiagnostics = { outcome: "fetch_error", elapsedMs: 0 };
  const fallback = () => ({ prompt: { ...getDailyPrompt(), kind: "fallback" as const }, diagnostics: { ...diagnostics, elapsedMs: Date.now() - started } });
  try {
    const response = await fetch("https://news.columbia.edu/", {
      cache: "force-cache", next: { revalidate: 6 * 3600, tags: [CAMPUS_NEWS_CACHE_TAG] },
      signal: AbortSignal.timeout(Math.min(10_000, Math.max(1000, timeoutMs))), redirect: "error",
      headers: { Accept: "text/html", "User-Agent": "CampusMargins/1.0 (+https://helloworld-chi-five.vercel.app)" },
    });
    diagnostics.upstreamStatus = response.status;
    diagnostics.contentType = response.headers.get("content-type")?.slice(0, 100);
    diagnostics.fetchedAt = sourceFetchedAt(response) ?? undefined;
    if (!response.ok) { diagnostics.outcome = "upstream_status"; await response.body?.cancel(); return fallback(); }
    if (!diagnostics.contentType?.includes("text/html")) { diagnostics.outcome = "unexpected_type"; await response.body?.cancel(); return fallback(); }
    diagnostics.outcome = "invalid_content";
    const body = await readBoundedBody(response, 1_000_000);
    diagnostics.bytes = body.byteLength;
    const stories = parseCampusNews(new TextDecoder().decode(body));
    diagnostics.storyCount = stories.length;
    // Prefer campus stories to unrelated national or international headlines.
    const story = stories.find((item) => item.category === "Campus & Community")
      ?? stories.find((item) => ["University News", "Photo of the Week", "Office Hours", "Campus News"].includes(item.category));
    if (!story) { diagnostics.outcome = stories.length ? "no_campus_stories" : "no_recent_stories"; return fallback(); }
    const prompt: CampusPrompt = {
      label: "Campus in the group chat",
      scene: `A Columbia student reacting in their group chat to this campus headline: “${story.title.slice(0, 160)}”. Keep the joke about everyday student life.`,
      sourceTitle: story.title, sourceUrl: story.url, publishedAt: story.publishedAt,
      fetchedAt: diagnostics.fetchedAt, kind: "news",
    };
    return { prompt, diagnostics: { ...diagnostics, outcome: "ok", elapsedMs: Date.now() - started } };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "TimeoutError" || error.name === "AbortError") diagnostics.outcome = "timeout";
      const cause = error.cause;
      if (cause && typeof cause === "object" && "code" in cause && typeof cause.code === "string" && /^[A-Z0-9_]{1,80}$/.test(cause.code)) diagnostics.errorCode = cause.code;
    }
    return fallback();
  }
}

export async function getCampusPrompt(): Promise<CampusPrompt> {
  return (await getCampusNewsResult()).prompt;
}
