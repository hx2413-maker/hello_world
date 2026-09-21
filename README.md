# Hello World — The Reading Room

Assignment 2 extends the original Next.js app with a live Supabase reading list at `/books`. The homepage links to the list. Rows are fetched on the server for each request through Supabase's REST API, using environment variables rather than hardcoded credentials.

## Supabase setup

1. Create a Supabase project and run `supabase/schema.sql` once in its SQL Editor. It creates and seeds six books, enables row-level security, and grants anonymous users read-only access.
2. Copy `.env.example` to `.env.local`.
3. Set `SUPABASE_URL` to the project URL and `SUPABASE_ANON_KEY` to its anon key. Never use a service-role key. `.env.local` is ignored by Git.

## Run locally

```sh
npm ci
npm run dev
```

Open `http://localhost:3000/books`. The list includes loading, empty, and database-error states. No sample rows are embedded in the page; displayed books come from Supabase.

## Validate and deploy

```sh
npm run lint
npm run build
```

Set the same two environment variables in the existing Vercel project's Production and Preview environments, then push to GitHub to trigger deployment. In Vercel project settings, disable Deployment Protection. Verify the unique deployment URL's `/books` page in an Incognito window, and submit that deployment-specific URL rather than the moving production alias.
