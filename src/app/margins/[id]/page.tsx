import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCaptionFeed, getGenerationForCaption } from "@/lib/margins";
import { CaptionCard } from "../caption-card";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata: Metadata = {
  title: "A city caption | City Margins",
  description: "A little New York moment, in AI’s words. Read, rate, and share this caption from City Margins at The Reading Room.",
};

export default async function CaptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, captions] = await Promise.all([getCurrentUser(), getCaptionFeed("new", 0, id)]);
  const caption = captions[0];
  if (!caption) notFound();
  // The data layer only returns a generation to its authenticated owner.
  const generation = user ? await getGenerationForCaption(id) : null;

  return (
    <main className="flex-1 bg-slate-950 px-5 py-12 text-white sm:px-10 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <Link href="/margins#caption-feed" className="rounded text-sm font-medium text-sky-300 hover:text-sky-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300">← Back to City Margins</Link>
        <header className="pb-8 pt-12">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-sky-300">The Reading Room / After hours</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">A moment in the margins.</h1>
          <p className="mt-3 text-sm leading-7 text-slate-400">{user ? "Keep the good lines coming. Vote up, vote down, or pass it on." : "A city moment, reimagined by AI. Sign in to cast your vote."}</p>
        </header>
        <CaptionCard caption={caption} signedIn={Boolean(user)} featured />
        {user ? <p className="mt-4 text-xs leading-6 text-slate-500">One vote per caption. Select your vote again to remove it.</p> : null}

        {generation ? (
          <section aria-labelledby="your-prompt-heading" className="mt-8 rounded-2xl border border-slate-800 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="your-prompt-heading" className="text-lg font-semibold">Behind your caption</h2>
              <span className="rounded-full border border-slate-700 px-3 py-1 text-[10px] text-slate-400">Only visible to you</span>
            </div>
            <p className="mt-5 text-xs font-medium text-slate-400">Your scene</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-200">{generation.scene}</p>
            <details className="mt-6 border-t border-slate-800 pt-5">
              <summary className="w-fit cursor-pointer rounded text-xs font-medium text-sky-300 hover:text-sky-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300">View saved generation prompts</summary>
              <div className="mt-5 space-y-5 text-xs leading-6">
                <div><h3 className="font-semibold text-slate-300">Creative direction</h3><p className="mt-2 whitespace-pre-wrap break-words text-slate-400">{generation.system_prompt}</p></div>
                <div><h3 className="font-semibold text-slate-300">Generation prompt</h3><p className="mt-2 whitespace-pre-wrap break-words text-slate-400">{generation.prompt}</p></div>
                <p className="text-slate-500">Generated with {generation.model}.</p>
              </div>
            </details>
          </section>
        ) : null}

        <section className="mt-10 flex flex-wrap items-center justify-between gap-5 border-t border-slate-800 pt-7" aria-label="Create a caption">
          <div><h2 className="font-semibold text-slate-200">Your city has a story, too.</h2><p className="mt-2 text-xs text-slate-400">Bring a little moment. Find a new way to say it.</p></div>
          <Link href={user ? "/margins#caption-studio" : "/login?next=%2Fmargins"} className="rounded-full bg-sky-300 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300">Make a caption ↗</Link>
        </section>
      </div>
    </main>
  );
}
