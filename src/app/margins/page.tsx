import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCaptionFeed } from "@/lib/margins";
import { getDailyPrompt } from "@/lib/margins-shared";
import { CaptionCard } from "./caption-card";
import { GenerationForm } from "./generation-form";
import { MemeIcon } from "./icons";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata: Metadata = {
  title: "City Margins — Campus life, meme material",
  description: "Your daily dose of campus chaos. Make AI memes from photos or ideas, vote for your favorites, and share the best of New York student life.",
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
    <main className="flex-1 px-4 pb-10 pt-7 sm:px-6 sm:pt-10">
      <div className="mx-auto max-w-[1160px]">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#5c7c98]"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#82acd0]" />Made for the group chat</div>
            <h1 className="text-[26px] font-extrabold tracking-[-0.045em] text-slate-950 sm:text-[34px]">Campus life. Meme material.</h1>
            <p className="mt-1.5 max-w-lg text-sm leading-6 text-slate-500">Small city moments. Unreasonably good captions. You pick the winners.</p>
          </div>
          <span className="hidden rotate-[-3deg] rounded-lg border border-[#c3d8e9] bg-[#e7f0f8] px-4 py-2 text-xs font-bold text-[#426c91] lg:block">NYC energy. Columbia blue.</span>
        </div>

        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section id="caption-feed" aria-labelledby="feed-heading" className="min-w-0">
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:px-5">
              <h2 id="feed-heading" className="text-sm font-bold text-slate-900">{sort === "top" ? "The crowd favorites" : "Fresh off the feed"}</h2>
              <nav aria-label="Sort memes" className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs font-bold">
                <Link href="/margins?sort=new#caption-feed" aria-current={sort === "new" ? "page" : undefined} className={`cm-focus flex items-center gap-1.5 rounded-md px-3 py-2 ${sort === "new" ? "bg-white text-[#245b89] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}><MemeIcon name="bolt" className="h-3.5 w-3.5" />New</Link>
                <Link href="/margins?sort=top#caption-feed" aria-current={sort === "top" ? "page" : undefined} className={`cm-focus flex items-center gap-1.5 rounded-md px-3 py-2 ${sort === "top" ? "bg-white text-[#245b89] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}><MemeIcon name="up" className="h-3.5 w-3.5" />Top</Link>
              </nav>
            </div>
            <p className="mb-4 px-1 text-[11px] leading-5 text-slate-500">{sort === "top" ? "Ranked by upvotes minus downvotes. " : ""}Community memes and labeled starters. {user ? "One vote each. Tap again to undo." : "Sign in to vote for the good ones."}</p>

            {captions.length ? (
              <ul className="space-y-5">{captions.map((caption) => <li key={caption.id}><CaptionCard caption={caption} signedIn={Boolean(user)} /></li>)}</ul>
            ) : (
              <div className="cm-card rounded-2xl px-7 py-16 text-center">
                <span aria-hidden="true" className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#edf4fa] text-[#7ba5c7]"><MemeIcon name="image" className="h-8 w-8" /></span>
                <h3 className="mt-5 text-xl font-bold tracking-tight">{page > 1 ? "You’re all caught up." : "The feed needs your sense of humor."}</h3>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">{page > 1 ? "Head back to the newest memes, or give the group chat something fresh." : "Turn a photo or a very specific campus moment into the first meme."}</p>
                <Link href={page > 1 ? "/margins#caption-feed" : "#caption-studio"} className="cm-focus mt-6 inline-flex items-center rounded-lg bg-[#245b89] px-5 py-3 text-sm font-bold text-white hover:bg-[#19456c]">{page > 1 ? "Back to new memes" : "Make the first meme"}<span aria-hidden="true" className="ml-2">↗</span></Link>
              </div>
            )}

            {page > 1 || captions.length === 12 ? (
              <nav aria-label="Meme pages" className="mt-6 flex items-center justify-between gap-4 text-xs font-semibold">
                {page > 1 ? <Link href={`/margins?sort=${sort}&page=${page - 1}#caption-feed`} className="cm-focus rounded-lg border border-slate-200 bg-white px-4 py-3 text-[#245b89] hover:border-[#8ab1cf]">← Previous</Link> : <span />}
                <span className="text-slate-400">Page {page}</span>
                {captions.length === 12 && page < 1000 ? <Link href={`/margins?sort=${sort}&page=${page + 1}#caption-feed`} className="cm-focus rounded-lg border border-slate-200 bg-white px-4 py-3 text-[#245b89] hover:border-[#8ab1cf]">More memes →</Link> : <span />}
              </nav>
            ) : null}
          </section>

          <aside className="space-y-5">
            <section id="caption-studio" aria-labelledby="studio-heading" className="cm-card scroll-mt-24 overflow-hidden rounded-2xl">
              <div className="border-b border-[#dbe6ef] bg-[#eaf2f9] px-5 py-5">
                <div className="flex items-center gap-2.5"><span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#5386af]"><MemeIcon name="sparkles" className="h-4 w-4" /></span><h2 id="studio-heading" className="text-lg font-bold tracking-tight text-[#204b70]">Make something funny.</h2></div>
                <p className="mt-2 text-xs leading-5 text-[#68839a]">Your photo or idea. AI’s best shot at a punchline.</p>
              </div>
              <div className="px-5 pb-5">
                {user ? <GenerationForm dailyScene={daily.scene} /> : (
                  <div className="pt-5">
                    <p className="text-sm leading-6 text-slate-600">Upload an image or describe a moment. Pick a voice. Let AI make it meme material.</p>
                    <div className="my-5 flex items-center gap-2 text-[11px] font-semibold text-slate-500"><span className="rounded-md bg-slate-100 px-2.5 py-1.5">Witty</span><span className="rounded-md bg-slate-100 px-2.5 py-1.5">Poetic</span><span className="rounded-md bg-slate-100 px-2.5 py-1.5">Deadpan</span></div>
                    <Link href="/login?next=%2Fmargins" className="cm-focus flex min-h-12 items-center justify-center rounded-xl bg-[#245b89] px-4 py-3 text-sm font-bold text-white hover:bg-[#19456c]">Sign in to create & vote <span aria-hidden="true" className="ml-2">↗</span></Link>
                    <p className="mt-3 text-center text-[11px] text-slate-400">Just your Google account. Then you’re in.</p>
                  </div>
                )}
              </div>
            </section>

            <section aria-labelledby="daily-prompt-heading" className="rounded-2xl border border-[#d7e4ee] bg-[#eaf2f8] px-5 py-5">
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#5d7f9b]"><MemeIcon name="bolt" className="h-3.5 w-3.5" />Today’s meme fuel</p>
              <h2 id="daily-prompt-heading" className="mt-3 text-base font-bold tracking-tight text-[#254965]">{daily.label}</h2>
              <p className="mt-2 text-xs leading-6 text-[#617b90]">{daily.scene}</p>
              <a href="#caption-studio" className="cm-focus mt-3 inline-block rounded text-[11px] font-bold text-[#245b89] hover:underline">Give it your spin ↗</a>
            </section>

            <section className="px-2 text-xs leading-6 text-slate-500" aria-label="About City Margins">
              <p className="font-bold text-slate-600">For the moments between everything.</p>
              <p className="mt-1">Dorm life, subway lore, and the things only your group chat gets. All AI captions are labeled. All votes come from people.</p>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200 pt-3 text-[10px] text-slate-400"><Link href="/privacy" className="cm-focus rounded hover:text-[#245b89]">Privacy</Link><span>City Margins · Made for campus</span></div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
