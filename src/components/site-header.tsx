import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/auth";

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
      <div className="mx-auto flex h-[72px] max-w-[1160px] items-center justify-between gap-3">
        <Link href="/margins" className="cm-focus flex shrink-0 items-center gap-2 rounded-lg sm:gap-2.5" aria-label="City Margins home">
          <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#c4d8ec] text-xl font-black text-[#174b7c] sm:h-9 sm:w-9">m<span className="text-white">.</span></span>
          <span className="text-base font-extrabold tracking-[-0.055em] text-slate-950 sm:text-[22px]">city margins<span className="text-[#5b8fb9]">.</span></span>
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-2 sm:gap-5">
          <Link href="/margins" className="cm-focus hidden rounded-md px-2 py-2 text-sm font-semibold text-slate-600 hover:text-[#245b89] sm:block">Feed</Link>
          <Link href="/margins#caption-studio" className="cm-focus inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#b8d1e6] bg-[#edf4fa] px-3 text-xs font-bold text-[#245b89] hover:bg-[#deebf6] sm:px-4 sm:text-sm"><span aria-hidden="true" className="text-lg leading-none">+</span> Create</Link>
          {user ? (
            <form action={signOut}><button type="submit" className="cm-focus min-h-10 cursor-pointer rounded-lg px-2 text-xs font-semibold text-slate-500 hover:text-slate-900 sm:text-sm">Sign out</button></form>
          ) : (
            <Link href="/login?next=%2Fmargins" className="cm-focus min-h-10 rounded-lg bg-[#245b89] px-3 py-2.5 text-xs font-bold text-white hover:bg-[#19456c] sm:px-4 sm:text-sm">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
