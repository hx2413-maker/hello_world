import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/auth";

const navigationLink =
  "rounded-md px-2 py-2 text-sm text-slate-300 transition-colors hover:text-sky-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-slate-800 bg-slate-950 px-6 text-white sm:px-12">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-3 py-5">
        <Link
          href="/"
          className="rounded-md text-lg font-semibold tracking-tight transition-colors hover:text-sky-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300"
        >
          The Reading Room<span className="text-sky-300">.</span>
        </Link>
        <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-2 sm:gap-4">
          <Link href="/" className={navigationLink}>Home</Link>
          <Link href="/margins" className={navigationLink}>City Margins</Link>
          <Link href="/books" className={navigationLink}>Books</Link>
          {user ? (
            <>
              <Link href="/members" className={navigationLink}>Members</Link>
              <Link href="/profile" className={navigationLink}>Profile</Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="cursor-pointer rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-sky-300 hover:text-sky-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-sky-300 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
