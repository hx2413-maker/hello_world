export default function MemberLoading() {
  return (
    <main className="flex-1 px-4 py-8 sm:px-6" aria-busy="true" aria-label="Loading member profile">
      <div className="mx-auto max-w-[1400px]">
        <p role="status" className="mb-6 text-xs font-semibold text-[#5d7f9b]">Loading this creator’s memes…</p>
        <div aria-hidden="true" className="motion-safe:animate-pulse">
          <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-5"><div className="h-20 w-20 shrink-0 rounded-full bg-slate-100" /><div className="w-full max-w-xs space-y-3"><div className="h-7 w-3/4 rounded-lg bg-slate-100" /><div className="h-4 rounded bg-slate-100" /></div></div>
            <div className="mt-6 flex gap-8 border-t border-slate-100 pt-5"><div className="h-12 w-24 rounded-lg bg-slate-100" /><div className="h-12 w-24 rounded-lg bg-slate-100" /></div>
          </div>
          <div className="mb-5 h-7 w-32 rounded-lg bg-slate-200" />
          <div className="grid grid-cols-1 gap-7 lg:grid-cols-3">{[0, 1, 2].map((item) => <div key={item}><div className="aspect-video rounded-2xl bg-slate-200" /><div className="mt-4 h-5 w-4/5 rounded bg-slate-200" /><div className="mt-3 h-4 w-2/3 rounded bg-slate-200" /></div>)}</div>
        </div>
      </div>
    </main>
  );
}
