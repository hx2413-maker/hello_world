import Link from "next/link";

export default function Home() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-slate-950 px-6 py-24 text-white sm:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.22),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.24),transparent_38%)]" />
      <section className="relative max-w-3xl text-center">
        <p className="mb-5 font-mono text-sm uppercase tracking-[0.35em] text-sky-300">
          The Reading Room · After hours
        </p>
        <h1 className="text-6xl font-black tracking-tight sm:text-8xl">
          Big city.<br /><span className="text-sky-300">Little stories.</span>
        </h1>
        <p className="mx-auto mt-7 max-w-xl text-lg leading-8 text-slate-300 sm:text-xl">
          The missed train. The library spiral. The weekend side quest.
          Turn a New York moment into an AI caption, then help the best lines rise.
        </p>
        <div className="mx-auto mt-10 h-1 w-24 rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-500" />
        <div className="mt-10 flex flex-wrap items-center justify-center gap-5">
          <Link href="/margins" className="inline-block rounded-full bg-sky-300 px-7 py-3 font-semibold text-slate-950 transition-colors hover:bg-sky-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300">Explore City Margins →</Link>
          <Link href="/books" className="rounded-md px-3 py-3 text-sm text-slate-300 hover:text-sky-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300">Find your next book</Link>
        </div>
        <p className="mt-7 text-sm text-slate-400">A fresh writing prompt each day. Read freely. Sign in to create and vote.</p>
      </section>
    </main>
  );
}
