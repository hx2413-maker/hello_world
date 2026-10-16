import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCaptionFeed, getGenerationForCaption } from "@/lib/margins";
import { CaptionCard } from "../caption-card";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata: Metadata = {
  title: "One for the group chat | City Margins",
  description: "An AI meme from City Margins. Vote, share, and make your own.",
};

export default async function CaptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, captions] = await Promise.all([getCurrentUser(), getCaptionFeed("new", 0, id)]);
  const caption = captions[0];
  if (!caption) notFound();
  const generation = user ? await getGenerationForCaption(id) : null;

  return (
    <main className="flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link href="/margins#caption-feed" className="cm-focus rounded text-xs font-bold text-[#245b89] hover:underline">← Back to the feed</Link>
          <span className="text-[11px] text-slate-400">Made for the group chat</span>
        </div>
        <h1 className="mb-5 text-2xl font-extrabold tracking-[-0.035em]">A little too relatable.</h1>
        <CaptionCard caption={caption} signedIn={Boolean(user)} featured />
        {user ? <p className="mt-3 px-1 text-[11px] text-slate-500">One vote per meme. Tap your vote again to undo.</p> : null}

        {generation ? (
          <section aria-labelledby="your-prompt-heading" className="cm-card mt-6 rounded-2xl p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="your-prompt-heading" className="text-sm font-bold">Behind your meme</h2><span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] text-slate-500">Only you can see this</span></div>
            <p className="mt-4 text-[11px] font-semibold text-slate-400">Your input</p>
            <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">{generation.scene}</p>
            <details className="mt-5 border-t border-slate-100 pt-4">
              <summary className="cm-focus w-fit cursor-pointer rounded text-xs font-semibold text-[#245b89] hover:underline">Saved AI prompts</summary>
              <div className="mt-4 space-y-4 text-xs leading-6">
                <div><h3 className="font-bold text-slate-600">Creative direction</h3><p className="mt-1.5 whitespace-pre-wrap break-words text-slate-500">{generation.system_prompt}</p></div>
                <div><h3 className="font-bold text-slate-600">Generation prompt</h3><p className="mt-1.5 whitespace-pre-wrap break-words text-slate-500">{generation.prompt}</p></div>
                <p className="text-slate-400">Generated with {generation.model}.</p>
              </div>
            </details>
          </section>
        ) : null}

        <section className="mt-7 flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-[#cbddea] bg-[#e8f1f8] p-6" aria-label="Create a meme">
          <div><h2 className="text-base font-bold tracking-tight text-[#254965]">Your camera roll has potential.</h2><p className="mt-1 text-xs text-[#68839a]">Turn a photo or a thought into the next good one.</p></div>
          <Link href="/create" className="cm-focus rounded-lg bg-[#245b89] px-4 py-3 text-xs font-bold text-white hover:bg-[#19456c]">Make a meme →</Link>
        </section>
        <footer className="mt-7 flex justify-between text-[10px] text-slate-400"><span>City Margins</span><Link href="/privacy" className="cm-focus rounded hover:text-[#245b89]">Privacy</Link></footer>
      </div>
    </main>
  );
}
