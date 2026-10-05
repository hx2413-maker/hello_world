import Link from "next/link";
import { cookies } from "next/headers";
import { getProfile, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AUTH_NEXT_COOKIE, getSafeAuthNext } from "@/lib/auth-next";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your Profile | The Reading Room" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const user = await requireUser();
  const query = await searchParams;
  const next = getSafeAuthNext(query.next) ?? getSafeAuthNext((await cookies()).get(AUTH_NEXT_COOKIE)?.value);
  const profile = await getProfile(user.id).catch(() => null);
  const needsNames = !profile?.first_name?.trim() || !profile?.last_name?.trim();
  let photoUrl: string | null = null;

  if (profile?.avatar_path?.startsWith(`${user.id}/`)) {
    const supabase = await createClient();
    const { data } = await supabase.storage.from("profile-photos").createSignedUrl(profile.avatar_path, 3600);
    photoUrl = data?.signedUrl ?? null;
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white sm:px-12">
      <div className="mx-auto max-w-3xl">
        <Link href="/books" className="text-sm text-sky-300 hover:underline">← Back to the books</Link>
        <header className="py-12 sm:py-16">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-sky-300">The reading room · Profile</p>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">A little about you.</h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-400">Update your name, add a photo, and make yourself at home.</p>
        </header>

        {profile ? (
          <>
            {needsNames ? (
              <div className="mb-6 rounded-xl border border-sky-300/30 bg-sky-300/10 p-5" role="status">
                <h2 className="font-semibold text-sky-100">Welcome! Let’s finish your profile.</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">Add your first and last name below to continue to {next ? "City Margins" : "the members’ reading room"}. Your photo is optional.</p>
              </div>
            ) : null}
            <ProfileForm firstName={profile.first_name} lastName={profile.last_name} photoUrl={photoUrl} email={user.email} next={next} />
          </>
        ) : (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8" role="alert">
            <h2 className="text-xl font-semibold">Your profile is temporarily unavailable.</h2>
            <p className="mt-3 leading-7 text-slate-400">We couldn’t load your reader profile. Please refresh in a moment. If this continues, sign out and sign in again.</p>
            {/* A full reload retries the database read even when this route was prefetched. */}
            <a href={next ? `/profile?next=${encodeURIComponent(next)}` : "/profile"} className="mt-5 inline-block rounded-full bg-sky-300 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-200">Try again</a>
          </section>
        )}
      </div>
    </main>
  );
}
