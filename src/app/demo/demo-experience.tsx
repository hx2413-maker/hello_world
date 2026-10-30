"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { MemeIcon } from "@/app/margins/icons";

export type DemoExample = { id: string; body: string; imageUrl: string | null; ai: boolean };

export function DemoExperience({ examples }: { examples: DemoExample[] }) {
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [session, setSession] = useState<"loading" | "ready" | "used" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [scene, setScene] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);
  const progress = Object.keys(votes).filter((id) => votes[id]).length;

  useEffect(() => {
    let active = true;
    fetch("/api/demo/session", { method: "POST", signal: AbortSignal.timeout(12_000) })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); return body; })
      .then((body) => { if (active) setSession(body.used ? "used" : "ready"); })
      .catch((failure) => { if (active) { setSession("error"); setError(failure instanceof Error ? failure.message : "Refresh to start your image preview."); } });
    return () => { active = false; };
  }, []);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  useEffect(() => { if (caption) resultRef.current?.focus(); }, [caption]);

  function selectFile(selected: File | null) {
    setError(null);
    if (!selected) { setFile(null); setPreview(null); return; }
    if (selected.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(selected.type)) {
      setFile(null); setPreview(null); setError("Choose a JPEG, PNG, WebP or GIF no larger than 2 MB."); return;
    }
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || pending || session !== "ready") return;
    setPending(true);
    setError(null);
    const data = new FormData();
    data.set("image", file);
    data.set("scene", scene);
    try {
      const response = await fetch("/api/demo/generate", { method: "POST", body: data, signal: AbortSignal.timeout(42_000) });
      const result = await response.json();
      if (result.used) setSession("used");
      if (!response.ok) throw new Error(result.error || "The preview couldn’t be generated.");
      setCaption(result.caption);
    } catch (failure) {
      setError(failure instanceof Error && failure.name !== "TimeoutError" ? failure.message : "The preview took too long. Refresh to check whether your attempt was used.");
      // A lost response may still have consumed the attempt. Query the database
      // before re-enabling the button instead of relying on browser state.
      try {
        const check = await fetch("/api/demo/session", { method: "POST", signal: AbortSignal.timeout(12_000) });
        const body = await check.json();
        setSession(check.ok ? body.used ? "used" : "ready" : "error");
      } catch { setSession("error"); }
    } finally { setPending(false); }
  }

  return <div className="mt-9 space-y-10">
    <section aria-labelledby="practice-vote-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-wide text-[#5b8fb9]">01 · Pick the punchlines</p><h2 id="practice-vote-title" className="mt-1 text-xl font-bold text-slate-900">Give a few practice votes.</h2></div>
        <p aria-live="polite" className="rounded-full bg-[#e7f1f8] px-3 py-2 text-xs font-semibold text-[#245b89]">{progress} of {examples.length} rated</p>
      </div>
      <p className="mb-5 text-sm leading-relaxed text-slate-600">Tap ↑ for your favorites or ↓ for a miss. Tap again to undo. These practice votes stay on this page and never change community scores.</p>
      <div className="grid gap-5 md:grid-cols-3">
        {examples.map((example) => <article key={example.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#dbe5ef] bg-white">
          {example.imageUrl ? <div className="aspect-[4/3] bg-[#e6edf3]"><Image src={example.imageUrl} alt="Community meme used for this practice example" width={600} height={450} unoptimized className="h-full w-full object-contain" /></div> : null}
          <div className={`flex flex-1 flex-col p-5 ${example.imageUrl ? "" : "min-h-60 justify-center bg-[#edf4fa]"}`}><span className="text-[10px] font-bold uppercase tracking-wider text-[#5b8fb9]">{example.ai ? "AI caption · practice example" : "Sample caption · practice example"}</span><p className="mt-3 break-words text-lg font-bold leading-snug text-slate-900">{example.body}</p></div>
          <div className="flex gap-3 border-t border-slate-100 p-4">
            {[1, -1].map((value) => <button key={value} onClick={() => setVotes((current) => ({ ...current, [example.id]: current[example.id] === value ? 0 : value }))} aria-pressed={votes[example.id] === value} aria-label={`${value === 1 ? "Upvote" : "Downvote"} practice example: ${example.body}`} className={`cm-focus flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border text-sm font-bold ${votes[example.id] === value ? "border-[#80add2] bg-[#e3eef7] text-[#245b89]" : "border-slate-200 bg-white text-slate-600"}`}><MemeIcon name={value === 1 ? "up" : "down"} className="h-5 w-5" />{votes[example.id] === value ? "Picked" : value === 1 ? "Hit" : "Miss"}</button>)}
          </div>
        </article>)}
      </div>
    </section>

    <section aria-labelledby="practice-create-title" className="overflow-hidden rounded-2xl border border-[#dbe5ef] bg-white">
      <div className="border-b border-[#dbe5ef] bg-[#e7f1f8] p-6 sm:p-7"><p className="text-xs font-bold uppercase tracking-wide text-[#5b8fb9]">02 · Find your campus punchline</p><h2 id="practice-create-title" className="mt-2 text-2xl font-bold tracking-tight text-[#173e5a]">Your photo. One free preview.</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">Upload an image or GIF. Gemini will read what’s in it and create a Columbia campus-life caption. Your preview stays private.</p></div>
      <div className="grid gap-6 p-6 sm:p-7 lg:grid-cols-2">
        <form onSubmit={generate} className="space-y-5">
          <div><label htmlFor="demo-image" className="block text-sm font-bold text-slate-700">Choose your image</label><input id="demo-image" name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={pending || session !== "ready"} onChange={(event) => selectFile(event.target.files?.[0] ?? null)} className="cm-focus mt-2 block w-full min-w-0 rounded-lg border border-slate-300 p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#edf4fa] file:px-3 file:py-2 file:font-semibold file:text-[#245b89] disabled:opacity-60" aria-describedby="demo-image-help" /><p id="demo-image-help" className="mt-2 text-xs text-slate-500">JPEG, PNG, WebP or GIF · up to 2 MB. GIFs: up to 15 seconds and 120 frames.</p></div>
          <div><label htmlFor="demo-scene" className="block text-sm font-bold text-slate-700">What’s the campus situation? <span className="font-normal text-slate-500">Optional</span></label><textarea id="demo-scene" value={scene} onChange={(event) => setScene(event.target.value)} maxLength={280} disabled={pending || session !== "ready"} rows={3} placeholder="Me arriving at Butler with 12 tabs open and no plan." className="cm-focus mt-2 w-full resize-y rounded-lg border border-slate-300 bg-[#f8fafc] p-3 text-sm leading-relaxed disabled:opacity-60" /></div>
          {session === "loading" ? <p role="status" className="text-sm text-slate-500">Preparing your private preview…</p> : null}
          {session === "used" && !caption ? <p className="rounded-xl bg-[#edf4fa] p-4 text-sm leading-relaxed text-[#245b89]">You’ve used this browser’s preview. You can keep practicing votes, or sign in to make and publish more memes.</p> : null}
          {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-relaxed text-red-800">{error}</p> : null}
          {session !== "used" ? <button disabled={!file || pending || session !== "ready"} className="cm-focus flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#245b89] px-4 py-3 text-sm font-bold text-white disabled:opacity-45"><MemeIcon name="sparkles" className="h-5 w-5" />{pending ? "Finding the punchline…" : "Generate my private preview"}</button> : null}
          <p className="text-xs leading-relaxed text-slate-500">One attempt per browser; three per network and 20 total each day. Attempts count once AI generation starts, including failures. Your image and scene go to Gemini. We don’t store the image; the prompt and caption are retained privately. <Link href="/privacy" className="cm-focus rounded underline">Privacy details</Link></p>
        </form>
        <div ref={resultRef} tabIndex={caption ? -1 : undefined} aria-live="polite" className="cm-focus flex min-h-72 flex-col overflow-hidden rounded-xl border border-[#dbe5ef] bg-[#f5f8fb]">
          {preview ? <>{caption ? <div className="border-b border-[#dbe5ef] bg-white p-5"><span className="text-[10px] font-bold uppercase tracking-wider text-[#5b8fb9]">AI caption · private preview</span><p className="mt-2 text-xl font-bold leading-snug text-slate-900">{caption}</p></div> : <p className="p-4 text-xs font-semibold text-[#5b8fb9]">Your selected image</p>}<Image src={preview} alt="Your selected image for the private meme preview" width={800} height={600} unoptimized className="max-h-96 w-full flex-1 object-contain" /></> : <div className="m-auto p-8 text-center"><MemeIcon name="image" className="mx-auto h-10 w-10 text-[#83a5c3]" /><p className="mt-3 text-sm font-semibold text-[#5b7791]">Your meme preview will appear here.</p><p className="mt-2 text-xs leading-relaxed text-slate-500">No public post. No account needed.</p></div>}
        </div>
      </div>
    </section>
    <section className="flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-[#173e5a] p-6 text-white sm:p-7"><div><h2 className="text-xl font-bold">Ready for the real feed?</h2><p className="mt-2 text-sm leading-relaxed text-[#c4d8ec]">Sign in to publish your memes, save tones and make your votes count.</p></div><Link href="/login?next=%2Fcreate" className="cm-focus inline-flex min-h-12 items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-bold text-[#173e5a]">Sign in & create →</Link></section>
  </div>;
}
