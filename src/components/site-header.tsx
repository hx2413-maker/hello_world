import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth";
import { getMyProfile } from "@/lib/profile";
import { Avatar } from "./avatar";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const profile = user ? await getMyProfile().catch(() => null) : null;
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
      <div className="mx-auto flex h-[72px] max-w-[1400px] items-center justify-between gap-3">
        <Link href="/margins" className="cm-focus flex shrink-0 items-center gap-2 rounded-lg sm:gap-2.5" aria-label="City Margins home">
          <Image src="/city-margins-mark.png" alt="" width={40} height={40} sizes="(min-width: 640px) 40px, 36px" loading="eager" className="h-9 w-9 shrink-0 sm:h-10 sm:w-10" />
          <span className="text-base font-extrabold tracking-[-0.055em] text-slate-950 sm:text-[22px]">city margins<span className="text-[#5b8fb9]">.</span></span>
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-2 sm:gap-5">
          <Link href="/margins" className="cm-focus hidden rounded-md px-2 py-2 text-sm font-semibold text-slate-600 hover:text-[#245b89] sm:block">Feed</Link>
          <Link href="/create" className="cm-focus inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[#b8d1e6] bg-[#edf4fa] px-3 text-xs font-bold text-[#245b89] hover:bg-[#deebf6] sm:px-4 sm:text-sm"><span aria-hidden="true" className="text-lg leading-none">+</span> Create</Link>
          {user ? (
            <Link href={`/members/${user.id}`} aria-label="Your profile" className="cm-focus flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full sm:rounded-lg sm:px-1"><Avatar src={profile?.avatar_url} name={profile?.display_name} size={34} /><span className="hidden text-sm font-semibold text-slate-600 sm:block">Profile</span></Link>
          ) : (
            <Link href="/login?next=%2Fmargins" className="cm-focus min-h-10 rounded-lg bg-[#245b89] px-3 py-2.5 text-xs font-bold text-white hover:bg-[#19456c] sm:px-4 sm:text-sm">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
