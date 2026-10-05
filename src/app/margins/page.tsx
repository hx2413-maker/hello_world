import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCaptionFeed } from "@/lib/margins";
import { getDailyPrompt } from "@/lib/margins-shared";
import { CaptionCard } from "./caption-card";
import { GenerationForm } from "./generation-form";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata: Metadata = {
  title: "City Margins | The Reading Room",
  description: "Turn your little New York moments into AI captions. Find a daily prompt, choose a voice, and vote for the lines worth sharing.",
};

type Query = { sort?: string | string[]; page?: string | string[] };

export default async function MarginsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const sort = query.sort === "top" ? "top" : "new";
  const pageValue = typeof query.page === "string" ? Number(query.page) : 1;
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? Math.min(pageValue, 1000) : 1;
  const [user, captions] = await Promise.all([getCurrentUser(), getCaptionFeed(sort, (page - 1) * 12)]);
  const daily = getDailyPrompt();

  return (
    <main className="relative flex-1 overflow-hidden bg-slate-950 px-5 pb-8 text-white sm:px-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[540px] bg-[radial-gradient(ellipse_at_70%_0%,rgba(56,189,248,0.09),transparent_65%)]" />
      <div className="relative mx-auto max-w-6xl">
        <header className="grid gap-10 border-b border-slate-800 pb-12 pt-12 lg:grid-cols-[1fr_310px] lg:items-end lg:gap-16 lg:pb-16 lg:pt-20">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-400 sm:text-xs">The Reading Room <span className="mx-2 text-slate-600">/</span> <span className="text-sky-300">After hours</span></p>
            <h1 className="mt-6 text-5xl font-bold leading-[1.06] tracking-[-0.05em] sm:text-7xl">City life.<br /><span className="text-sky-300">With a better caption.</span></h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">For the missed trains, midnight slices, and surprisingly good days. Turn a small New York moment into a line worth sharing.</p>
            <div className="mt-7 flex items-center gap-3 text-xs text-slate-300">
              <span className="h-px w-7 bg-sky-300/60" aria-hidden="true" />
              You bring the city. AI brings the words. We pick the good ones.
            </div>
          </div>
          <aside className="rounded-2xl border border-sky-300/20 bg-sky-300/[0.04] p-6" aria-labelledby="daily-prompt-heading">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-sky-300"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-sky-300" />Today’s prompt</div>
            <h2 id="daily-prompt-heading" className="mt-4 font-serif text-2xl leading-snug text-slate-100">{daily.label}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">{daily.scene}</p>
            <a href="#caption-studio" className="mt-5 inline-flex min-h-9 items-center rounded text-xs font-semibold text-sky-300 hover:text-sky-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300">Make it your own <span aria-hidden="true" className="ml-2">↘</span></a>
            <p className="mt-2 text-[10px] text-slate-500">A fresh starting point every day · UTC</p>
          </aside>
        </header>

        <div className="grid items-start gap-10 pt-10 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-10 lg:pt-12">
          <section id="caption-studio" aria-labelledby="studio-heading" className="scroll-mt-8 rounded-2xl border border-slate-800 bg-slate-900/40 p-6 sm:p-7">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-300/20 bg-sky-300/5 text-lg text-sky-300">✦</span>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">City Margins</p>
                <h2 id="studio-heading" className="mt-1 text-lg font-semibold tracking-tight">Your moment, remixed.</h2>
              </div>
            </div>
            {user ? (
              <GenerationForm dailyScene={daily.scene} />
            ) : (
              <div className="mt-6">
                <p className="text-sm leading-7 text-slate-400">Describe a city moment. Pick witty, poetic, or deadpan. Get an AI caption for everyone to weigh in on.</p>
                <div className="my-6 flex flex-wrap gap-2" aria-label="Available caption voices">
                  {["Witty", "Poetic", "Deadpan"].map((voice) => <span key={voice} className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300">{voice}</span>)}
                </div>
                <Link href="/login?next=%2Fmargins" className="flex min-h-12 items-center justify-center rounded-full bg-sky-300 px-5 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-sky-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300">Sign in to create & rate <span aria-hidden="true" className="ml-2">↗</span></Link>
                <p className="mt-4 text-xs leading-6 text-slate-400">The feed is open to everyone. Sign in to publish a caption and cast your vote.</p>
              </div>
            )}
          </section>

          <section id="caption-feed" aria-labelledby="feed-heading" className="min-w-0 scroll-mt-8">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">From campus to downtown</p>
                <h2 id="feed-heading" className="mt-2 text-2xl font-semibold tracking-tight">In the margins</h2>
              </div>
              <nav aria-label="Sort captions" className="flex rounded-full border border-slate-700 bg-slate-900/60 p-1 text-xs">
                <Link href="/margins?sort=new#caption-feed" aria-current={sort === "new" ? "page" : undefined} className={`rounded-full px-4 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300 ${sort === "new" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}>Newest</Link>
                <Link href="/margins?sort=top#caption-feed" aria-current={sort === "top" ? "page" : undefined} className={`rounded-full px-4 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300 ${sort === "top" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}>Top rated</Link>
              </nav>
            </div>
            <p className="mb-6 text-xs leading-6 text-slate-400">{sort === "top" ? "The community’s favorites, ranked by upvotes minus downvotes." : "Freshly generated lines from the city. A good one deserves your vote."} {user ? "One vote per caption; tap again to undo." : "Sign in to help the best lines rise."}</p>
            {captions.length > 0 ? (
              <ul className="space-y-5">
                {captions.map((caption) => <li key={caption.id}><CaptionCard caption={caption} signedIn={Boolean(user)} /></li>)}
              </ul>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-700 px-7 py-14 text-center sm:px-12">
                <span aria-hidden="true" className="font-serif text-5xl text-sky-300/70">“ ”</span>
                <h3 className="mt-4 text-xl font-semibold">{page > 1 ? "You’ve reached the last line." : "The city has stories. Start one."}</h3>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-slate-400">{page > 1 ? "Head back to the latest captions, or add a new moment of your own." : "Be the first to turn a little New York moment into an AI caption. Today’s prompt is a good place to begin."}</p>
                <Link href={page > 1 ? "/margins#caption-feed" : user ? "#caption-studio" : "/login?next=%2Fmargins"} className="mt-6 inline-block rounded text-sm font-medium text-sky-300 hover:text-sky-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300">{page > 1 ? "Back to the latest" : user ? "Write the first caption" : "Sign in to write the first caption"} →</Link>
              </div>
            )}
            {page > 1 || captions.length === 12 ? (
              <nav aria-label="Caption pages" className="mt-7 flex items-center justify-between gap-4 text-sm">
                {page > 1 ? <Link href={`/margins?sort=${sort}&page=${page - 1}#caption-feed`} className="rounded py-2 text-sky-300 hover:text-sky-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300">← Previous</Link> : <span />}
                <span className="font-mono text-xs text-slate-500">Page {page}</span>
                {captions.length === 12 && page < 1000 ? <Link href={`/margins?sort=${sort}&page=${page + 1}#caption-feed`} className="rounded py-2 text-sky-300 hover:text-sky-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300">Next →</Link> : <span />}
              </nav>
            ) : null}
          </section>
        </div>

        <footer className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 py-6 text-xs text-slate-500">
          <p>City Margins <span className="mx-2 text-slate-700">/</span> A little outside the syllabus.</p>
          <Link href="/books" className="rounded text-slate-400 hover:text-sky-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300">Back to the books ↗</Link>
        </footer>
      </div>
    </main>
  );
}
