import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/auth";
import { getMyProfile } from "@/lib/profile";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your profile — City Margins", robots: { index: false, follow: false } };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fprofile");
  const profile = await getMyProfile();

  return (
    <main className="flex-1 px-4 py-7 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/margins" className="cm-focus rounded text-xs font-semibold text-[#245b89] hover:underline">← Back to the feed</Link>
        <div className="mb-6 mt-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5c7c98]">Make it yours</p>
          <h1 className="mt-2 text-[30px] font-extrabold tracking-[-0.045em] text-slate-950 sm:text-4xl">Your profile</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Give your memes a familiar face and a name.</p>
        </div>

        <section aria-label="Edit your public profile" className="cm-card overflow-hidden rounded-2xl">
          <ProfileForm initialProfile={profile} />
        </section>

        <section aria-labelledby="account-heading" className="cm-card mt-5 rounded-2xl p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <h2 id="account-heading" className="text-sm font-bold text-slate-800">Your account</h2>
              {user.email ? <p className="mt-2 break-all text-sm text-slate-600">{user.email}</p> : null}
              <p className="mt-1 text-xs leading-6 text-slate-500">Your sign-in email stays private.</p>
            </div>
            <form action={signOut}><button type="submit" className="cm-focus min-h-11 cursor-pointer rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-600 hover:border-slate-400 hover:text-slate-900">Sign out</button></form>
          </div>
        </section>
        <p className="mt-5 text-center text-xs text-slate-400"><Link href="/privacy" className="cm-focus rounded hover:text-[#245b89]">Privacy at City Margins</Link></p>
      </div>
    </main>
  );
}
