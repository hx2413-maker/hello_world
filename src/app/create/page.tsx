import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCampusPrompt } from "@/lib/campus-news";
import { getMemeTemplate } from "@/lib/meme-templates";
import { getSharedTones } from "@/lib/tones";
import { createIntentUrl, readCreateIntent } from "@/lib/create-intent";
import { GenerationForm } from "@/app/margins/generation-form";
import { MemeIcon } from "@/app/margins/icons";
import { canOpenPromptChains, PROMPT_CHAINS_URL } from "@/lib/prompt-chains";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata: Metadata = {
  title: "Create a meme — Campus Margins",
  description: "Turn a campus moment, photo, GIF, or favorite template into a Columbia meme with AI.",
  robots: { index: false, follow: false },
};

export default async function CreatePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [query, user] = await Promise.all([searchParams, getCurrentUser()]);
  const intent = readCreateIntent(query);
  if (!user) redirect(`/login?next=${encodeURIComponent(createIntentUrl(intent))}`);
  const [daily, tones, template, canManageChains] = await Promise.all([
    getCampusPrompt(), getSharedTones(user.id), intent.template ? getMemeTemplate(intent.template) : Promise.resolve(null),
    canOpenPromptChains(),
  ]);
  const initialScene = intent.scene ?? (intent.prompt === "today" ? daily.scene : "");

  return (
    <main className="flex-1 px-4 pb-10 pt-6 sm:px-6 sm:pt-9">
      <div className="mx-auto max-w-2xl">
        <Link href="/margins" className="cm-focus inline-flex min-h-11 items-center rounded text-xs font-bold text-[#245b89] hover:underline">← Back to the feed</Link>
        <div className="mb-6 mt-3">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#486b87]"><MemeIcon name="sparkles" className="h-4 w-4" />The campus meme studio</p>
          <h1 className="mt-3 text-[30px] font-extrabold tracking-[-0.045em] text-slate-950 sm:text-4xl">Make something funny.</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Start with a campus moment or an image. Pick a community tone or invent your own.</p>
          <Link href="/templates" className="cm-focus mt-3 inline-flex min-h-11 items-center rounded-lg border border-[#cbddea] bg-white px-3 text-xs font-bold text-[#245b89] hover:bg-[#edf4fa]">Browse popular meme templates →</Link>
        </div>
        {intent.template && !template ? <p role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">That template isn’t available right now. Choose another from the library or upload an image.</p> : null}
        {daily.sourceUrl ? <p className="mb-3 text-xs leading-5 text-slate-600">Today’s inspiration: <a href={daily.sourceUrl} target="_blank" rel="noopener noreferrer" className="cm-focus rounded text-[#245b89] underline underline-offset-4">{daily.sourceTitle ?? "Columbia source"} ↗</a>{daily.publishedAt ? ` · ${new Date(daily.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}` : ""}</p> : null}
        <section aria-label="Create and publish your meme" className="cm-card rounded-2xl p-4 sm:p-7">
          <GenerationForm key={`${daily.scene}:${createIntentUrl(intent)}`} dailyScene={daily.scene} dailyLabel={daily.label} initialScene={initialScene} initialTone={intent.tone} tones={tones} userId={user.id} initialTemplate={template ?? undefined} />
        </section>
        {canManageChains ? <section aria-label="Prompt chain tools" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#cbddea] bg-[#edf4fa] p-4"><div><h2 className="text-sm font-bold text-[#254965]">Build a prompt chain</h2><p className="mt-1 text-xs leading-5 text-[#48647a]">Connect image descriptions, ideas, and captions in a sequence. Superadmin access.</p></div><a href={PROMPT_CHAINS_URL} className="cm-focus inline-flex min-h-11 items-center rounded-lg bg-white px-4 text-xs font-bold text-[#245b89] hover:bg-[#deebf6]">Open Prompt Chain Studio ↗</a></section> : null}
        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-slate-500"><span>Campus Margins · Made for the group chat</span><Link href="/privacy" className="cm-focus inline-flex min-h-11 items-center rounded hover:text-[#245b89]">Privacy</Link></footer>
      </div>
    </main>
  );
}
