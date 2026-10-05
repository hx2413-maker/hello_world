import Link from "next/link";
import type { Caption } from "@/lib/margins-shared";
import { ShareLink } from "./share-link";
import { VoteControls } from "./vote-controls";

const vibeLabels = { witty: "Witty", poetic: "Poetic", deadpan: "Deadpan" };

export function CaptionCard({ caption, signedIn, featured = false }: { caption: Caption; signedIn: boolean; featured?: boolean }) {
  const date = new Date(caption.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const sourceLabel = caption.is_starter ? "City Margins starter" : caption.is_owner ? "Your caption" : "Community caption";

  return (
    <article className={`relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/45 ${featured ? "p-7 sm:p-12" : "p-6 sm:p-8"}`} aria-label={`${vibeLabels[caption.vibe]} AI caption`}>
      <div aria-hidden="true" className="absolute left-0 top-8 h-10 w-0.5 bg-sky-300/70" />
      <header className="flex flex-wrap items-center justify-between gap-3 text-[11px]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <span className="rounded-full border border-sky-300/20 bg-sky-300/5 px-2.5 py-1 font-medium text-sky-200">AI generated</span>
          <span className="text-slate-400">{vibeLabels[caption.vibe]}</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="font-medium text-slate-300">{sourceLabel}</span>
        </div>
        <Link href={`/margins/${caption.id}`} className="rounded text-slate-400 hover:text-sky-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300" aria-label={`Open caption from ${date}`}>
          <time dateTime={caption.created_at}>{date}</time>
        </Link>
      </header>
      <blockquote className={`break-words font-serif leading-relaxed tracking-tight text-slate-100 ${featured ? "py-12 text-3xl sm:text-5xl" : "py-8 text-2xl sm:text-[1.75rem]"}`}>
        {caption.body}
      </blockquote>
      <footer className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-t border-slate-800 pt-5">
        {signedIn ? (
          <VoteControls captionId={caption.id} viewerVote={caption.viewer_vote} upvotes={caption.upvotes} downvotes={caption.downvotes} />
        ) : (
          <div className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2">
            <span className="font-mono text-xs text-slate-400" aria-label={`${caption.upvotes} upvotes and ${caption.downvotes} downvotes`}><span aria-hidden="true">↑ {caption.upvotes} <span className="mx-1.5 text-slate-600">/</span> ↓ {caption.downvotes}</span></span>
            <Link href={`/login?next=${encodeURIComponent(`/margins/${caption.id}`)}`} className="rounded text-xs font-medium text-sky-300 hover:text-sky-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300">Sign in to rate →</Link>
          </div>
        )}
        <ShareLink captionId={caption.id} />
      </footer>
    </article>
  );
}
