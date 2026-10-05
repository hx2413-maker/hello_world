import Link from "next/link";

export default function CaptionNotFound() {
  return (
    <main className="flex flex-1 items-center bg-slate-950 px-6 py-24 text-white">
      <section className="mx-auto w-full max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-sky-300">City Margins / 404</p>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">This line isn’t in the margins.</h1>
        <p className="mt-5 text-base leading-8 text-slate-400">We couldn’t find that caption. There are more city moments waiting in the feed.</p>
        <Link href="/margins" className="mt-8 inline-block rounded-full bg-sky-300 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300">Back to City Margins →</Link>
      </section>
    </main>
  );
}
