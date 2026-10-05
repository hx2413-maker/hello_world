"use client";

import Link from "next/link";

export default function MarginsError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="flex flex-1 items-center bg-slate-950 px-6 py-24 text-white">
      <section className="mx-auto w-full max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-sky-300">City Margins</p>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">A pause between the lines.</h1>
        <p className="mt-5 text-base leading-8 text-slate-400">The captions couldn’t load right now. Give it another try in a moment.</p>
        <div className="mt-8 flex flex-wrap items-center gap-6">
          <button type="button" onClick={retry} className="cursor-pointer rounded-full bg-sky-300 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300">Try again</button>
          <Link href="/books" className="rounded text-sm text-sky-300 hover:text-sky-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300">Browse the books →</Link>
        </div>
      </section>
    </main>
  );
}
