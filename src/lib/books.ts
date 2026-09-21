export type Book = {
  id: number;
  title: string;
  author: string;
  category: string;
  description: string;
};

async function queryBooks(id?: string): Promise<Book[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase environment variables are missing.");
  }

  const endpoint = new URL("/rest/v1/books", url);
  endpoint.searchParams.set("select", "id,title,author,category,description");
  endpoint.searchParams.set("order", "id.asc");
  if (id) {
    endpoint.searchParams.set("id", `eq.${id}`);
    endpoint.searchParams.set("limit", "1");
  }

  const response = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed (${response.status}).`);
  }

  return response.json();
}

export function getBooks(): Promise<Book[]> {
  return queryBooks();
}

export async function getBook(id: string): Promise<Book | null> {
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return null;
  const books = await queryBooks(id);
  return books[0] ?? null;
}
