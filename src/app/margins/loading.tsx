export default function MarginsLoading() {
  return (
    <main className="flex-1 bg-slate-950 px-5 py-16 sm:px-10" aria-busy="true" aria-label="Loading City Margins">
      <div className="mx-auto max-w-6xl">
        <p role="status" className="font-mono text-xs uppercase tracking-[0.2em] text-sky-300">Opening City Margins…</p>
        <div aria-hidden="true" className="mt-8 motion-safe:animate-pulse">
          <div className="h-12 w-3/4 max-w-lg rounded-lg bg-slate-800" />
          <div className="mt-4 h-12 w-full max-w-2xl rounded-lg bg-slate-800" />
          <div className="mt-8 h-5 w-2/3 max-w-lg rounded bg-slate-900" />
          <div className="mt-16 grid items-start gap-8 lg:grid-cols-[340px_1fr]">
            <div className="h-96 rounded-2xl border border-slate-800 bg-slate-900/50" />
            <div className="space-y-5"><div className="h-60 rounded-2xl border border-slate-800 bg-slate-900/50" /><div className="h-60 rounded-2xl border border-slate-800 bg-slate-900/50" /></div>
          </div>
        </div>
      </div>
    </main>
  );
}
