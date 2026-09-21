import Link from "next/link";
import { getBooks } from "@/lib/books";

export const dynamic = "force-dynamic";
export const metadata = { title: "The Reading Room | Hello World" };

export default async function BooksPage() {
  let books;
  try {
    books = await getBooks();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Unable to load books.");
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-24 text-white">
        <section className="mx-auto max-w-3xl">
          <Link href="/" className="text-sky-300 hover:underline">← Home</Link>
          <h1 className="mt-10 text-4xl font-bold">The shelves are temporarily unavailable.</h1>
          <p className="mt-5 text-slate-300">We couldn’t load the reading list. Please try again in a moment.</p>
          <a href="/books" className="mt-8 inline-block rounded-full bg-sky-300 px-6 py-3 font-semibold text-slate-950">Try again</a>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white sm:px-12">
      <div className="mx-auto max-w-6xl">
        <nav className="flex items-center justify-between border-b border-slate-800 pb-6" aria-label="Main navigation">
          <Link href="/" className="font-semibold tracking-tight hover:text-sky-300">Hello, world.</Link>
          <span className="font-mono text-xs uppercase tracking-widest text-slate-400">The reading room</span>
        </nav>
        <header className="max-w-3xl py-16 sm:py-24">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-sky-300">A small collection of big ideas</p>
          <h1 className="mt-6 text-5xl font-bold tracking-tight sm:text-7xl">Your next chapter<br /><span className="text-sky-300">starts here.</span></h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">Stories to get lost in. Ideas to take with you. Browse a little shelf of books worth making time for.</p>
        </header>
        <section aria-labelledby="collection-heading">
          <div className="mb-7 flex items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <h2 id="collection-heading" className="text-xl font-semibold">On the shelf</h2>
            <p className="font-mono text-sm text-slate-400">{books.length} {books.length === 1 ? "book" : "books"}</p>
          </div>
          {books.length === 0 ? (
            <p className="rounded-2xl border border-slate-800 p-10 text-slate-400">The shelf is empty. Check back soon for new books.</p>
          ) : (
            <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {books.map((book, index) => (
                <li key={book.id} className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/60 p-7 transition-colors hover:border-sky-700">
                  <div className="mb-10 flex items-center justify-between gap-4">
                    <span className="rounded-full bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-300">{book.category}</span>
                    <span className="font-mono text-sm text-slate-500">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="text-2xl font-semibold tracking-tight">{book.title}</h3>
                  <p className="mt-2 text-sm text-sky-200">{book.author}</p>
                  <p className="mt-5 text-sm leading-7 text-slate-400">{book.description}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <footer className="mt-16 flex flex-wrap justify-between gap-3 border-t border-slate-800 py-7 text-xs text-slate-500">
          <p>Hello World · The Reading Room</p>
          <p>Live collection · Powered by Supabase</p>
        </footer>
      </div>
    </main>
  );
}
