import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signInWithGoogle } from "@/app/auth/actions";
import { getCurrentUser, getProfile, isProfileComplete } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in | The Reading Room",
  description: "Sign in to your Reading Room profile and member space.",
};

const signInErrors = new Map([
  ["auth", "Your sign-in was interrupted or the link expired. Continue with Google to try again."],
  ["oauth", "We couldn’t start Google sign-in. Please try again in a moment."],
]);

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const user = await getCurrentUser();

  if (user) {
    // The profile route provides a retry state if the database is unavailable.
    const profile = await getProfile(user.id).catch(() => null);
    redirect(isProfileComplete(profile) ? "/members" : "/profile");
  }

  const { error } = await searchParams;
  const errorCode = Array.isArray(error) ? error[0] : error;
  const errorMessage = errorCode
    ? signInErrors.get(errorCode) ?? "We couldn’t finish signing you in. Please try again."
    : null;

  return (
    <main className="relative flex flex-1 items-center overflow-hidden bg-slate-950 px-6 py-16 text-white sm:px-12 sm:py-24">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(56,189,248,0.12),transparent_55%)]" />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <section className="max-w-xl">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-sky-300">The Reading Room</p>
          <h1 className="mt-6 text-5xl font-bold tracking-tight sm:text-6xl">A place for your<br /><span className="text-sky-300">next chapter.</span></h1>
          <p className="mt-6 max-w-md text-lg leading-8 text-slate-400">Make yourself at home. Sign in to set up your profile and step into our member reading room.</p>
          <Link href="/books" className="mt-8 inline-block rounded-md text-sm font-medium text-sky-300 hover:text-sky-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300">Browse the books first →</Link>
        </section>
        <section aria-labelledby="sign-in-heading" className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 sm:p-10">
          <div aria-hidden="true" className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-300/20 bg-sky-300/10 text-sky-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
              <path d="M12 5.5C9.5 4 6.5 3.5 3 4v15c3.5-.5 6.5 0 9 1.5M12 5.5C14.5 4 17.5 3.5 21 4v15c-3.5-.5-6.5 0-9 1.5M12 5.5v15" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 id="sign-in-heading" className="text-3xl font-semibold tracking-tight">Welcome in.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">Use your Google account to sign in or join. On your first visit, we’ll ask for your first and last name.</p>
          {errorMessage && (
            <p role="alert" className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-100">{errorMessage}</p>
          )}
          <form action={signInWithGoogle} className="mt-8">
            <button type="submit" className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-full bg-white px-6 py-3.5 font-semibold text-slate-950 transition-colors hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300">
              <span aria-hidden="true" className="text-lg font-bold">G</span>
              Continue with Google
            </button>
          </form>
          <p className="mt-5 text-center text-xs leading-6 text-slate-500">Your books are always open to browse. Your profile and member space are just for you.</p>
          <p className="mt-3 text-center text-xs">
            <Link href="/privacy" className="rounded-sm text-slate-400 underline decoration-slate-600 underline-offset-4 hover:text-sky-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300">Privacy notice</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
