import Link from "next/link";
import { notFound } from "next/navigation";
import { getBook } from "@/lib/books";

export const dynamic = "force-dynamic";
export const metadata = { title: "Book details | The Reading Room" };

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) notFound();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white sm:px-12">
      <article className="mx-auto max-w-3xl">
        <Link href="/books" className="text-sm font-medium text-sky-300 hover:underline">← Back to all books</Link>
        <header className="mt-16 border-b border-slate-800 pb-10">
          <p className="font-mono text-sm uppercase tracking-widest text-sky-300">{book.category}</p>
          <h1 className="mt-5 text-5xl font-bold leading-tight tracking-tight sm:text-6xl">{book.title}</h1>
          <p className="mt-6 text-xl text-slate-300">By {book.author}</p>
        </header>
        <section className="py-10" aria-labelledby="about-book">
          <h2 id="about-book" className="text-xl font-semibold">About this book</h2>
          <p className="mt-5 text-lg leading-9 text-slate-300">{book.description}</p>
        </section>
        <footer className="border-t border-slate-800 pt-7 text-sm text-slate-500">The Reading Room · Live from Supabase</footer>
      </article>
    </main>
  );
}
