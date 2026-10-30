import type { Metadata } from "next";
import Link from "next/link";
import { getMemeTemplates } from "@/lib/meme-templates";
import { TemplateGallery } from "./template-gallery";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Meme templates — Campus Margins",
  description: "Find a popular meme image and give it a Columbia campus punchline.",
};

export default async function TemplatesPage() {
  const catalog = await getMemeTemplates();
  const fetched = catalog.fetchedAt ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" }).format(new Date(catalog.fetchedAt)) : null;
  return (
    <main className="flex-1 px-4 pb-12 pt-7 sm:px-6 sm:pt-10">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#486b87]">The campus meme toolkit</p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.045em] text-slate-950 sm:text-4xl">Find your next meme.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Familiar images. Your campus context. Pick a template, add a moment, and let AI find the punchline.</p>
          </div>
          <Link href="/create" className="cm-focus inline-flex min-h-11 items-center rounded-lg border border-[#b8d1e6] bg-white px-4 text-sm font-bold text-[#245b89] hover:bg-[#edf4fa]">Upload your own image →</Link>
        </div>
        <div className="mb-6 rounded-xl border border-[#d2e2ef] bg-[#eaf3f9] px-4 py-3 text-xs leading-5 text-[#486b87]">
          Popular templates from <a href="https://imgflip.com/memetemplates" target="_blank" rel="noopener noreferrer" className="cm-focus rounded font-semibold underline underline-offset-2">Imgflip</a>. The library refreshes weekly.
          {fetched ? <span> Catalog snapshot: {fetched}.</span> : null}
        </div>
        {catalog.status === "available" ? <TemplateGallery templates={catalog.templates} /> : (
          <section className="cm-card rounded-2xl px-6 py-12 text-center" role="status">
            <h2 className="text-lg font-bold text-slate-900">The template library is taking a break.</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">We couldn’t reach Imgflip right now. You can still create a meme with your own image or an idea.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link href="/templates" className="cm-focus inline-flex min-h-11 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-[#245b89]">Try again</Link>
              <Link href="/create" className="cm-focus inline-flex min-h-11 items-center rounded-lg bg-[#245b89] px-4 text-sm font-bold text-white">Create a meme</Link>
            </div>
          </section>
        )}
        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500"><span>Campus Margins · Made for the campus group chat</span><Link href="/privacy" className="cm-focus rounded py-3 hover:text-[#245b89]">Privacy</Link></footer>
      </div>
    </main>
  );
}
