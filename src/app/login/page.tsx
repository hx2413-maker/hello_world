import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signInWithGoogle } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/auth";
import { AUTH_NEXT_COOKIE, getSafeAuthNext } from "@/lib/auth-next";

export const metadata: Metadata = { title: "Sign in | City Margins", description: "Sign in to create AI memes, vote for your favorites, and share the campus chaos." };
const signInErrors = new Map([["auth", "Your sign-in was interrupted or the link expired. Continue with Google to try again."], ["oauth", "We couldn’t start Google sign-in. Please try again in a moment."]]);

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string | string[]; next?: string | string[] }> }) {
  const query = await searchParams;
  const next = getSafeAuthNext(query.next) ?? getSafeAuthNext((await cookies()).get(AUTH_NEXT_COOKIE)?.value);
  const user = await getCurrentUser();
  if (user) redirect(next ?? "/margins");
  const errorCode = Array.isArray(query.error) ? query.error[0] : query.error;
  const errorMessage = errorCode ? signInErrors.get(errorCode) ?? "We couldn’t finish signing you in. Please try again." : null;

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-14 sm:py-20">
      <section aria-labelledby="sign-in-heading" className="cm-card w-full max-w-md overflow-hidden rounded-3xl">
        <div className="border-b border-[#d8e5ee] bg-[#e8f1f8] px-8 pb-8 pt-10 text-center">
          <Image src="/city-margins-mark.png" alt="" width={72} height={72} sizes="72px" loading="eager" className="mx-auto h-18 w-18" />
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.17em] text-[#6285a1]">City Margins</p>
          <h1 id="sign-in-heading" className="mt-3 text-3xl font-extrabold leading-tight tracking-[-0.04em] text-[#1b3d58]">Good memes need<br />good company.</h1>
          <p className="mx-auto mt-4 max-w-xs text-sm leading-6 text-[#627e93]">Make something funny. Vote for what hits. Send it to the group chat.</p>
        </div>
        <div className="p-7 sm:p-8">
          {errorMessage ? <p role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">{errorMessage}</p> : null}
          <form action={signInWithGoogle}>
            {next ? <input type="hidden" name="next" value={next} /> : null}
            <button type="submit" className="cm-focus flex min-h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-800 hover:border-[#9dbfd9] hover:bg-[#f5f9fc]"><span aria-hidden="true" className="text-lg font-black text-[#4285f4]">G</span>Continue with Google</button>
          </form>
          <p className="mt-4 text-center text-xs leading-6 text-slate-500">One account for creating and voting.<br />No extra profile to fill out.</p>
          <div className="mt-7 flex items-center justify-center gap-5 border-t border-slate-100 pt-5 text-[11px]"><Link href="/margins" className="cm-focus rounded font-semibold text-[#245b89] hover:underline">Just browsing? Back to the feed</Link><Link href="/privacy" className="cm-focus rounded text-slate-400 hover:text-slate-600">Privacy</Link></div>
        </div>
      </section>
    </main>
  );
}
