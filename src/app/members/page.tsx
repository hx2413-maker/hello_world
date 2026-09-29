import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile, isProfileComplete, requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Members | The Reading Room",
  description: "Your member space in The Reading Room.",
};

export default async function MembersPage() {
  const user = await requireUser();
  // Keep the session and use the profile page's retry UI on a failed read.
  const profile = await getProfile(user.id).catch(() => null);

  if (!profile || !isProfileComplete(profile)) {
    redirect("/profile");
  }

  return (
    <main className="flex-1 bg-slate-950 px-6 py-14 text-white sm:px-12 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1.5 text-xs font-medium text-sky-300">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-sky-300" />
            Member reading room
          </p>
          <h1 className="mt-7 break-words text-4xl font-bold tracking-tight sm:text-6xl">Welcome, <span className="text-sky-300">{profile.first_name?.trim()}.</span></h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">Your seat is saved. Settle in, discover a story, and make a little room for a new idea.</p>
        </header>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section aria-labelledby="reading-ritual-heading" className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60 p-8 sm:p-10">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(56,189,248,0.12),transparent_70%)]" />
            <div className="relative">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-sky-300">A reading ritual</p>
              <h2 id="reading-ritual-heading" className="mt-5 max-w-sm text-3xl font-semibold tracking-tight sm:text-4xl">Take ten quiet minutes.</h2>
              <p className="mt-5 max-w-lg leading-7 text-slate-400">Choose a book that catches your eye. Read a few pages without rushing, then carry one thought into the rest of your day.</p>
              <ol className="mt-8 space-y-5">
                {[
                  ["Open a new door", "Try a story or subject you wouldn’t usually choose."],
                  ["Notice one thing", "Pause at a sentence that makes you see differently."],
                  ["Keep the question", "What idea would you like to return to tomorrow?"],
                ].map(([title, description], index) => (
                  <li key={title} className="flex gap-4">
                    <span aria-hidden="true" className="pt-1 font-mono text-xs text-sky-300">0{index + 1}</span>
                    <div>
                      <h3 className="font-medium text-slate-100">{title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link href="/books" className="mt-9 inline-block rounded-full bg-sky-300 px-6 py-3 font-semibold text-slate-950 transition-colors hover:bg-sky-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300">Find your next book →</Link>
            </div>
          </section>

          <section aria-labelledby="member-profile-heading" className="self-start rounded-3xl border border-slate-800 bg-slate-900/40 p-8 sm:p-10">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-500">Your membership</p>
            <h2 id="member-profile-heading" className="mt-5 break-words text-2xl font-semibold">{profile.first_name?.trim()} {profile.last_name?.trim()}</h2>
            {user.email && <p className="mt-2 break-all text-sm leading-6 text-slate-400">{user.email}</p>}
            <div className="my-7 h-px bg-slate-800" />
            <p className="text-sm leading-7 text-slate-400">Make this space feel like you. Update your name or add a profile photo whenever you like.</p>
            <Link href="/profile" className="mt-6 inline-block rounded-md text-sm font-semibold text-sky-300 hover:text-sky-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300">Edit your profile →</Link>
          </section>
        </div>
        <p className="mt-8 text-xs leading-6 text-slate-500">This member space is available while you’re signed in.</p>
      </div>
    </main>
  );
}
