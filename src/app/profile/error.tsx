"use client";

import Link from "next/link";

export default function ProfileError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main className="flex flex-1 items-center px-5 py-20"><section className="cm-card mx-auto w-full max-w-lg rounded-2xl p-8 text-center sm:p-12"><h1 className="text-3xl font-extrabold tracking-tight">Your profile needs a second.</h1><p className="mt-4 text-sm leading-7 text-slate-500">We couldn’t load your profile just now. Please try again.</p><div className="mt-7 flex flex-wrap items-center justify-center gap-5"><button type="button" onClick={retry} className="cm-focus cursor-pointer rounded-lg bg-[#245b89] px-5 py-3 text-sm font-bold text-white hover:bg-[#19456c]">Try again</button><Link href="/margins" className="cm-focus rounded text-xs font-semibold text-[#245b89] hover:underline">Back to the feed</Link></div></section></main>;
}
