import "server-only";
import { parseCampusNews, readBoundedBody, sourceFetchedAt } from "./content-sources";
import { getDailyPrompt } from "./margins-shared";

export const CAMPUS_NEWS_CACHE_TAG = "campus-news";
export type CampusPrompt = {
  label: string; scene: string; sourceTitle?: string; sourceUrl?: string;
  publishedAt?: string; fetchedAt?: string; kind: "news" | "holiday" | "fallback";
};

export async function getCampusPrompt(): Promise<CampusPrompt> {
  try {
    const response = await fetch("https://news.columbia.edu/", {
      cache: "force-cache", next: { revalidate: 6 * 3600, tags: [CAMPUS_NEWS_CACHE_TAG] },
      signal: AbortSignal.timeout(3500), redirect: "error", headers: { Accept: "text/html" },
    });
    if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) throw new Error("News source unavailable.");
    const body = await readBoundedBody(response, 1_000_000);
    const stories = parseCampusNews(new TextDecoder().decode(body));
    // Prefer campus stories to unrelated national or international headlines.
    const story = stories.find((item) => item.category === "Campus & Community")
      ?? stories.find((item) => ["University News", "Photo of the Week", "Office Hours"].includes(item.category));
    if (!story) throw new Error("No recent campus story.");
    return {
      label: "Campus in the group chat",
      scene: `A Columbia student reacting in their group chat to this campus headline: “${story.title.slice(0, 160)}”. Keep the joke about everyday student life.`,
      sourceTitle: story.title, sourceUrl: story.url, publishedAt: story.publishedAt,
      fetchedAt: sourceFetchedAt(response) ?? undefined, kind: "news",
    };
  } catch {
    return { ...getDailyPrompt(), kind: "fallback" };
  }
}
