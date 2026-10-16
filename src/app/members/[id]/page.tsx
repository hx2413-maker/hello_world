import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { getCurrentUser } from "@/lib/auth";
import { getCaptionFeed } from "@/lib/margins";
import { isUuid } from "@/lib/margins-shared";
import { getPublicMember } from "@/lib/profile";
import { CaptionCard } from "@/app/margins/caption-card";
import { MemeIcon } from "@/app/margins/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Member profile — City Margins",
  description: "Explore a creator’s published memes and the upvotes they’ve earned on City Margins.",
};

type Query = { sort?: string | string[]; page?: string | string[]; deleted?: string | string[] };

export default async function MemberPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Query>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  const sort = query.sort === "top" ? "top" : "new";
  const pageValue = typeof query.page === "string" ? Number(query.page) : 1;
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? Math.min(pageValue, 1000) : 1;
  const [member, user] = await Promise.all([getPublicMember(id), getCurrentUser()]);
  if (!member) notFound();
  const captions = await getCaptionFeed(sort, (page - 1) * 12, undefined, id);
  const profileHref = `/members/${member.id}`;
  const hasMore = page * 12 < member.meme_count && page < 1000;

  return (
    <main className="flex-1 px-4 pb-10 pt-7 sm:px-6 sm:pt-10">
      <div className="mx-auto max-w-[1400px]">
        <Link href="/margins" className="cm-focus rounded text-xs font-semibold text-[#245b89] hover:underline">← Back to the feed</Link>

        {member.is_owner && query.deleted === "1" ? <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Meme deleted.</p> : null}

        <section aria-labelledby="member-heading" className="cm-card mb-8 mt-5 rounded-2xl p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex min-w-0 items-center gap-4 sm:gap-5">
              <Avatar src={member.avatar_url} name={member.display_name} size={80} />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5c7c98]">{member.is_owner ? "Your public profile" : "City Margins creator"}</p>
                <h1 id="member-heading" className="mt-1 break-words text-2xl font-extrabold tracking-[-0.035em] text-slate-950 sm:text-3xl">{member.display_name}</h1>
                <p className="mt-1.5 text-sm text-slate-500">A little campus chaos, a lot of personality.</p>
              </div>
            </div>
            {member.is_owner ? (
              <Link href="/profile" className="cm-focus inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-[#b8d1e6] bg-[#edf4fa] px-4 text-sm font-bold text-[#245b89] hover:bg-[#deebf6]">Edit profile</Link>
            ) : null}
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-5 border-t border-slate-100 pt-5 sm:flex sm:gap-10">
            <div>
              <dt className="text-xs font-medium text-slate-500">Published memes</dt>
              <dd className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight text-slate-900">{member.meme_count.toLocaleString("en-US")}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Upvotes received</dt>
              <dd className="mt-1 flex items-center gap-1.5 text-2xl font-extrabold tabular-nums tracking-tight text-[#245b89]"><MemeIcon name="up" className="h-5 w-5" />{member.total_upvotes.toLocaleString("en-US")}</dd>
            </div>
          </dl>
        </section>

        <section id="member-memes" aria-labelledby="member-memes-heading">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="member-memes-heading" className="text-lg font-bold tracking-tight text-slate-900">{member.is_owner ? "Your memes" : "Published memes"}</h2>
            <nav aria-label="Sort this creator’s memes" className="flex items-center gap-1 rounded-lg bg-slate-200/60 p-1 text-xs font-bold">
              <Link href={`${profileHref}?sort=new#member-memes`} aria-current={sort === "new" ? "page" : undefined} className={`cm-focus flex min-h-10 items-center gap-1.5 rounded-md px-3 py-2 ${sort === "new" ? "bg-white text-[#245b89] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}><MemeIcon name="bolt" className="h-3.5 w-3.5" />New</Link>
              <Link href={`${profileHref}?sort=top#member-memes`} aria-current={sort === "top" ? "page" : undefined} className={`cm-focus flex min-h-10 items-center gap-1.5 rounded-md px-3 py-2 ${sort === "top" ? "bg-white text-[#245b89] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}><MemeIcon name="up" className="h-3.5 w-3.5" />Top</Link>
            </nav>
          </div>
          <p className="mb-5 text-xs leading-5 text-slate-500">{sort === "top" ? "Ranked by upvotes minus downvotes. " : ""}{member.is_owner ? "Your published memes appear here. Only you can delete them." : user ? "Found a good one? Give it an upvote." : "Sign in to vote for your favorites."}</p>

          {captions.length ? (
            <ul className="grid grid-cols-1 gap-x-6 gap-y-7 lg:grid-cols-3">
              {captions.map((caption) => <li key={caption.id}><CaptionCard caption={caption} signedIn={Boolean(user)} manageOwn={member.is_owner} /></li>)}
            </ul>
          ) : (
            <div className="cm-card rounded-2xl px-6 py-14 text-center sm:py-16">
              <span aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf4fa] text-[#7ba5c7]"><MemeIcon name="image" className="h-7 w-7" /></span>
              <h3 className="mt-5 text-xl font-bold tracking-tight">{page > 1 ? "You’ve reached the end." : member.is_owner ? "Your first meme belongs here." : "No memes published yet."}</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">{page > 1 ? "Head back to this creator’s newest memes." : member.is_owner ? "Start with a photo, GIF, or a very specific campus moment." : "When this creator publishes a meme, you’ll find it here."}</p>
              <Link href={page > 1 ? profileHref : member.is_owner ? "/create" : "/margins"} className="cm-focus mt-6 inline-flex min-h-11 items-center rounded-lg bg-[#245b89] px-5 py-3 text-sm font-bold text-white hover:bg-[#19456c]">{page > 1 ? "Back to newest memes" : member.is_owner ? "Create a meme" : "Explore the feed"}<span aria-hidden="true" className="ml-2">→</span></Link>
            </div>
          )}

          {page > 1 || hasMore ? (
            <nav aria-label="Creator’s meme pages" className="mt-7 flex items-center justify-between gap-4 text-xs font-semibold">
              {page > 1 ? <Link href={`${profileHref}?sort=${sort}&page=${page - 1}#member-memes`} className="cm-focus rounded-lg border border-slate-200 bg-white px-4 py-3 text-[#245b89] hover:border-[#8ab1cf]">← Previous</Link> : <span />}
              <span className="text-slate-500">Page {page}</span>
              {hasMore ? <Link href={`${profileHref}?sort=${sort}&page=${page + 1}#member-memes`} className="cm-focus rounded-lg border border-slate-200 bg-white px-4 py-3 text-[#245b89] hover:border-[#8ab1cf]">More memes →</Link> : <span />}
            </nav>
          ) : null}
        </section>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6 text-xs text-slate-500"><span>City Margins · AI captions. Human votes.</span><Link href="/privacy" className="cm-focus rounded hover:text-[#245b89]">Privacy</Link></footer>
      </div>
    </main>
  );
}
