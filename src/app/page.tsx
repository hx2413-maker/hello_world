export default function Home() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.22),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.24),transparent_38%)]" />
      <section className="relative max-w-3xl text-center">
        <p className="mb-5 font-mono text-sm uppercase tracking-[0.35em] text-sky-300">
          Next.js · GitHub · Vercel
        </p>
        <h1 className="text-6xl font-black tracking-tight sm:text-8xl">
          Hello, world.
        </h1>
        <p className="mx-auto mt-7 max-w-xl text-lg leading-8 text-slate-300 sm:text-xl">
          A tiny idea, shipped all the way from a local commit to the edge.
        </p>
        <div className="mx-auto mt-10 h-1 w-24 rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-500" />
      </section>
    </main>
  );
}
