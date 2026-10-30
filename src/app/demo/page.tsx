import Link from "next/link";
import type { Metadata } from "next";
import { getCaptionFeed } from "@/lib/margins";
import { DemoExperience, type DemoExample } from "./demo-experience";

export const metadata: Metadata = { title: "Try it first | Campus Margins", description: "Practice rating campus memes and try one private AI caption from your image. No account needed." };

export default async function DemoPage() {
  let examples: DemoExample[];
  try {
    examples = (await getCaptionFeed("top")).slice(0, 3).map(({ id, body, image_url }) => ({ id, body, imageUrl: image_url, ai: true }));
  } catch { examples = []; }
  if (!examples.length) examples = [
    { id: "butler", body: "My Butler study session has entered its third hour of choosing a seat.", imageUrl: null, ai: false },
    { id: "group", body: "Five people in the group project. Six fonts. Zero paragraphs.", imageUrl: null, ai: false },
    { id: "core", body: "Calling the reading optional was the syllabus’s first act of fiction.", imageUrl: null, ai: false },
  ];
  return <main className="flex-1 px-4 py-9 sm:px-6">
    <div className="mx-auto max-w-[1120px]">
      <Link href="/margins" className="cm-focus inline-flex min-h-11 items-center rounded text-sm font-bold text-[#245b89]">← Back to the feed</Link>
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-[#5b8fb9]">No account needed</p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Get the joke. Try the loop.</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">Pick your favorites, then give one of your photos a campus punchline. Everything here is practice; nothing gets published.</p>
      <DemoExperience examples={examples} />
      <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 py-6 text-xs text-slate-500"><span>Campus Margins · Made for the group chat</span><Link href="/privacy" className="cm-focus rounded py-2 hover:underline">Privacy</Link></footer>
    </div>
  </main>;
}
