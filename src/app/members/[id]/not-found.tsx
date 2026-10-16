import Link from "next/link";

export default function MemberNotFound() {
  return (
    <main className="flex flex-1 items-center px-5 py-20">
      <section className="cm-card mx-auto w-full max-w-lg rounded-2xl p-8 text-center sm:p-12">
        <p className="text-xs font-bold uppercase tracking-widest text-[#7097b6]">City Margins · 404</p>
        <h1 className="mt-5 text-3xl font-extrabold tracking-tight">This profile isn’t here.</h1>
        <p className="mt-4 text-sm leading-7 text-slate-500">We couldn’t find that creator. Explore the feed to find your next favorite meme.</p>
        <Link href="/margins" className="cm-focus mt-7 inline-flex min-h-11 items-center rounded-lg bg-[#245b89] px-5 py-3 text-sm font-bold text-white hover:bg-[#19456c]">Back to the feed →</Link>
      </section>
    </main>
  );
}
