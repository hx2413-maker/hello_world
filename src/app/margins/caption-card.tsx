import Image from "next/image";
import Link from "next/link";
import type { Caption } from "@/lib/margins-shared";
import { Avatar } from "@/components/avatar";
import { ShareLink } from "./share-link";
import { VoteControls } from "./vote-controls";
import { MemeIcon } from "./icons";

const vibeLabels = { witty: "Witty", poetic: "Poetic", deadpan: "Deadpan" };

export function CaptionCard({ caption, signedIn, featured = false }: { caption: Caption; signedIn: boolean; featured?: boolean }) {
  const date = new Date(caption.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const sourceLabel = caption.is_starter ? "City Margins starter" : caption.author_name || (caption.is_owner ? "Your meme" : "Community meme");
  return (
    <article className={`cm-card overflow-hidden rounded-2xl ${featured ? "" : "cm-gallery-card"}`} aria-label={`${vibeLabels[caption.vibe]} AI meme`}>
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 py-4 sm:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
          {caption.is_starter ? <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#edf4fa] text-[#5b8fb9]"><MemeIcon name="sparkles" className="h-3.5 w-3.5" /></span> : <Avatar src={caption.author_avatar_url} name={caption.author_name} size={28} />}
          <span className="min-w-0 max-w-full break-words font-bold text-slate-700">{sourceLabel}</span>{caption.is_owner && caption.author_name && !caption.is_starter ? <span className="rounded bg-[#edf4fa] px-1.5 py-0.5 text-xs font-semibold text-[#456780]">You</span> : null}<span aria-hidden="true" className="text-slate-300">·</span>
          <Link href={`/margins/${caption.id}`} className="cm-focus rounded text-slate-500 hover:text-[#245b89]" aria-label={`Open meme from ${date}`}><time dateTime={caption.created_at}>{date}</time></Link>
        </div>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">AI caption · {vibeLabels[caption.vibe]}</span>
      </header>

      {caption.image_url ? (
        <Link href={`/margins/${caption.id}`} className="cm-focus cm-image-meme block border-y border-slate-100" aria-label={`Open meme: ${caption.body}`}>
          <p className={`cm-image-caption cm-meme-type whitespace-pre-wrap break-words px-5 py-6 leading-tight text-slate-950 sm:px-7 ${featured ? "text-3xl sm:text-4xl" : "text-2xl sm:text-[30px]"}`}>{caption.body}</p>
          <div className="cm-image-visual"><Image src={caption.image_url} alt="Uploaded image for this community meme" width={1200} height={900} unoptimized className="h-auto max-h-[680px] w-full bg-slate-100 object-contain" /></div>
        </Link>
      ) : (
        <Link href={`/margins/${caption.id}`} className="cm-focus cm-text-meme relative flex min-h-64 items-center justify-center overflow-hidden border-y border-slate-100 bg-[#f5f8fb] px-7 py-12 sm:min-h-72 sm:px-12" aria-label={`Open meme: ${caption.body}`}>
          <span aria-hidden="true" className="absolute left-5 top-4 text-[10px] font-bold uppercase tracking-[0.15em] text-[#7999b5]">Campus life. Meme material.</span>
          <p className={`cm-meme-type whitespace-pre-wrap break-words text-center leading-[1.18] text-[#182c40] ${featured ? "text-3xl sm:text-5xl" : "text-[28px] sm:text-[36px]"}`}>{caption.body}</p>
          {caption.image_path ? <p className="absolute inset-x-5 bottom-3 text-center text-xs text-slate-600">Image unavailable right now. Refresh to try again.</p> : <span aria-hidden="true" className="absolute bottom-4 right-5 text-[10px] font-bold tracking-tight text-[#8ca9c0]">city margins.</span>}
        </Link>
      )}

      <footer className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 sm:px-6">
        {signedIn ? <VoteControls captionId={caption.id} viewerVote={caption.viewer_vote} upvotes={caption.upvotes} downvotes={caption.downvotes} /> : (
          <div className="flex min-h-11 flex-wrap items-center gap-3">
            <span className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-500" aria-label={`${caption.upvotes} upvotes and ${caption.downvotes} downvotes`}><span aria-hidden="true" className="flex items-center gap-1.5"><MemeIcon name="up" className="h-4 w-4" />{caption.upvotes}</span><span aria-hidden="true" className="h-4 w-px bg-slate-200" /><span aria-hidden="true" className="flex items-center gap-1.5"><MemeIcon name="down" className="h-4 w-4" />{caption.downvotes}</span></span>
            <Link href={`/login?next=${encodeURIComponent(`/margins/${caption.id}`)}`} className="cm-focus inline-flex min-h-11 items-center rounded text-xs font-bold text-[#245b89] hover:underline">Sign in to vote</Link>
          </div>
        )}
        <div className="flex max-w-full flex-wrap items-start gap-2">
          {!featured ? <Link href={`/margins/${caption.id}`} aria-label={`View meme by ${sourceLabel}`} className="cm-focus inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-bold text-[#245b89] hover:bg-[#edf4fa] hover:underline lg:hidden">View meme <span aria-hidden="true" className="ml-1.5">→</span></Link> : null}
          <ShareLink captionId={caption.id} />
        </div>
      </footer>
    </article>
  );
}
