import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDailyPrompt } from "@/lib/margins-shared";
import { GenerationForm } from "@/app/margins/generation-form";
import { MemeIcon } from "@/app/margins/icons";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata: Metadata = {
  title: "Create a meme — City Margins",
  description: "Turn an idea, photo, or GIF into a Columbia and NYC meme with AI.",
  robots: { index: false, follow: false },
};

export default async function CreatePage({ searchParams }: { searchParams: Promise<{ prompt?: string | string[] }> }) {
  const [query, user] = await Promise.all([searchParams, getCurrentUser()]);
  const useDailyIdea = query.prompt === "today";
  if (!user) {
    const destination = useDailyIdea ? "/create?prompt=today" : "/create";
    redirect(`/login?next=${encodeURIComponent(destination)}`);
  }
  const daily = getDailyPrompt();

  return (
    <main className="flex-1 px-4 pb-10 pt-6 sm:px-6 sm:pt-9">
      <div className="mx-auto max-w-2xl">
        <Link href="/margins" className="cm-focus inline-flex min-h-11 items-center rounded text-xs font-bold text-[#245b89] hover:underline">← Back to the feed</Link>
        <div className="mb-6 mt-3">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#486b87]"><MemeIcon name="sparkles" className="h-4 w-4" />The meme studio</p>
          <h1 className="mt-3 text-[30px] font-extrabold tracking-[-0.045em] text-slate-950 sm:text-4xl">Make something funny.</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Start with a moment, photo, or GIF. Pick a tone, and AI adds a Columbia and NYC punchline.</p>
        </div>

        <section aria-label="Create and publish your meme" className="cm-card rounded-2xl p-4 sm:p-7">
          <GenerationForm key={`${daily.scene}:${useDailyIdea}`} dailyScene={daily.scene} dailyLabel={daily.label} initialScene={useDailyIdea ? daily.scene : ""} />
        </section>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-slate-500"><span>City Margins · Made for the group chat</span><Link href="/privacy" className="cm-focus inline-flex min-h-11 items-center rounded hover:text-[#245b89]">Privacy</Link></footer>
      </div>
    </main>
  );
}
