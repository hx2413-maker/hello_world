import Link from "next/link";

export default function BookNotFound() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-24 text-center text-white">
      <h1 className="text-4xl font-bold">Book not found</h1>
      <p className="mt-5 text-slate-300">This book is no longer on the shelf, or the link is incorrect.</p>
      <Link href="/books" className="mt-8 inline-block text-sky-300 hover:underline">← Back to all books</Link>
    </main>
  );
}
