import "server-only";
import { parseCampusNews, parseUpcomingHolidays, readBoundedBody, sourceFetchedAt } from "./content-sources";
import { getDailyPrompt } from "./margins-shared";

export const CAMPUS_NEWS_CACHE_TAG = "campus-news";
export type CampusPrompt = {
  label: string; scene: string; sourceTitle?: string; sourceUrl?: string;
  publishedAt?: string; fetchedAt?: string; kind: "news" | "holiday" | "fallback";
};

type NewsDiagnostics = {
  provider: "columbia-news" | "nager-holidays";
  outcome: "ok" | "upstream_status" | "unexpected_type" | "no_recent_stories" | "no_campus_stories" | "timeout" | "fetch_error" | "invalid_content";
  upstreamStatus?: number; contentType?: string; fetchedAt?: string;
  bytes?: number; storyCount?: number; elapsedMs: number; errorCode?: string;
  alternate?: NewsDiagnostics;
};

type CampusNewsResult = { prompt: CampusPrompt; diagnostics: NewsDiagnostics };

async function getColumbiaNewsResult(timeoutMs: number): Promise<CampusNewsResult> {
  const started = Date.now();
  const diagnostics: NewsDiagnostics = { provider: "columbia-news", outcome: "fetch_error", elapsedMs: 0 };
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

async function getHolidayResult(timeoutMs: number): Promise<CampusNewsResult> {
  const started = Date.now();
  const now = new Date();
  const year = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric" }).format(now));
  const diagnostics: NewsDiagnostics = { provider: "nager-holidays", outcome: "fetch_error", elapsedMs: 0 };
  const fallback = () => ({ prompt: { ...getDailyPrompt(), kind: "fallback" as const }, diagnostics: { ...diagnostics, elapsedMs: Date.now() - started } });
  try {
    // The next year is only needed for the late-December rollover. Both requests
    // are public API reads, cached with the same daily refresh tag.
    const years = now.getUTCMonth() === 11 ? [year, year + 1] : [year];
    const batches = await Promise.all(years.map(async (calendarYear) => {
      const response = await fetch(`https://nagerholidays.com/api/v3/publicholidays/${calendarYear}/US`, {
        cache: "force-cache", next: { revalidate: 6 * 3600, tags: [CAMPUS_NEWS_CACHE_TAG] },
        signal: AbortSignal.timeout(Math.min(10_000, Math.max(1000, timeoutMs))), redirect: "error",
        headers: { Accept: "application/json" },
      });
      diagnostics.upstreamStatus = response.status;
      diagnostics.contentType = response.headers.get("content-type")?.slice(0, 100);
      diagnostics.fetchedAt = sourceFetchedAt(response) ?? undefined;
      if (!response.ok) { diagnostics.outcome = "upstream_status"; await response.body?.cancel(); throw new Error("Holiday provider unavailable."); }
      if (!diagnostics.contentType?.includes("application/json")) { diagnostics.outcome = "unexpected_type"; await response.body?.cancel(); throw new Error("Unexpected holiday format."); }
      diagnostics.outcome = "invalid_content";
      const body = await readBoundedBody(response, 50_000);
      diagnostics.bytes = (diagnostics.bytes ?? 0) + body.byteLength;
      return parseUpcomingHolidays(JSON.parse(new TextDecoder().decode(body)), now);
    }));
    const holidays = batches.flat().sort((a, b) => a.date.localeCompare(b.date));
    diagnostics.storyCount = holidays.length;
    const holiday = holidays[0];
    if (!holiday) { diagnostics.outcome = "no_recent_stories"; return fallback(); }
    const holidayDate = `${holiday.date}T12:00:00.000Z`;
    const displayDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }).format(new Date(holidayDate));
    return {
      prompt: {
        label: `Holiday idea: ${holiday.name}`,
        scene: `${holiday.name} is on ${displayDate}. My group chat is making plans; my Butler reading pile has other ideas.`,
        sourceTitle: "U.S. holiday calendar · Nager.Date (not Columbia’s class schedule)",
        sourceUrl: `https://nagerholidays.com/publicholiday/united-states/${holiday.date.slice(0, 4)}`,
        publishedAt: holidayDate, fetchedAt: diagnostics.fetchedAt, kind: "holiday",
      },
      diagnostics: { ...diagnostics, outcome: "ok", elapsedMs: Date.now() - started },
    };
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) diagnostics.outcome = "timeout";
    return fallback();
  }
}

export async function getCampusNewsResult(timeoutMs = 3500): Promise<CampusNewsResult> {
  // Fetch independent public sources in parallel, keeping a cold page within
  // one bounded timeout. A denied news request is not retried or circumvented.
  const [news, holiday] = await Promise.all([getColumbiaNewsResult(timeoutMs), getHolidayResult(timeoutMs)]);
  if (news.prompt.kind === "news") return news;
  if (holiday.prompt.kind === "holiday") return { ...holiday, diagnostics: { ...holiday.diagnostics, alternate: news.diagnostics } };
  return { ...news, diagnostics: { ...news.diagnostics, alternate: holiday.diagnostics } };
}

export async function getCampusPrompt(): Promise<CampusPrompt> {
  return (await getCampusNewsResult()).prompt;
}
