"use client";

import Link from "next/link";

export default function BookError({ retry }: { retry: () => void }) {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-24 text-center text-white">
      <h1 className="text-4xl font-bold">We couldn’t load this book.</h1>
      <p className="mt-5 text-slate-300">Please try again in a moment.</p>
      <button onClick={retry} className="mt-8 rounded-full bg-sky-300 px-6 py-3 font-semibold text-slate-950">Try again</button>
      <p className="mt-6"><Link href="/books" className="text-sky-300 hover:underline">← Back to all books</Link></p>
    </main>
  );
}
