# Hello World — The Reading Room

Assignment 4 adds **City Margins** to the existing Reading Room: signed-in members generate short AI captions about campus and NYC life, publish them, and vote on the community’s captions. The app retains the Assignment 3 Google sign-in, required profile setup, private photos, books, and protected member room.

## City Margins

Visit `/margins` to browse the public feed. Sign in to describe a scene (10–280 characters), choose witty/poetic/deadpan, and **Generate & publish**. A server action verifies the session, reserves a database-backed quota slot, calls Gemini, and atomically saves the caption. Each result has a permanent `/margins/<uuid>` page. Its creator can expand the exact saved prompts; other visitors cannot read those records. The UI explicitly explains that the caption is public and may contain details from the scene.

An upvote or downvote inserts one `votes` row keyed to the caption and authenticated user. Repeating the same vote does not duplicate it; changing it updates that row, and selecting it again removes it. Votes and scores persist across refreshes. Newest and Top rated provide chronological and score-based discovery with pagination. Guests can read and share captions but cannot invoke generation or vote mutations. Sign-in returns users to the caption they were viewing, including after required profile completion.

### Product choices for Sam

- **A daily starting point:** a rotating UTC daily prompt draws on dorms, Butler, the 1 train, bookstores, and inexpensive weekend adventures. It reduces blank-page friction and gives students a reason to return. The 14 authored prompts cycle; the app does not claim they are live NYC news.
- **A small, specific format:** one short caption and three voices keep creation quick and recognizable. Bookish city humor connects the new feature to the existing Reading Room instead of adding an unrelated generator.
- **Community selection and sharing:** real vote totals and permanent links help good lines travel. The setup script creates three real Gemini-generated examples from a separate starter account so early visitors have something to rate; they are explicitly labeled “City Margins starter.” There are no invented activity counts or seeded fake votes.
- **Improvement on the assignment’s upload-to-caption pattern:** users can participate without supplying a personal photo, choose the voice, and see their saved creative direction. Private source prompts and clear public-output labeling reduce surprises; votes help readers discover the strongest results.

PM feedback has not yet been supplied. During the feedback session, test whether Sam can generate and rate a caption without explanation, whether the daily prompt feels relevant, and whether voting feels useful. Record the PM’s actual observations and changes made; do not describe uncollected feedback as completed iteration.

### Assignment 4 database setup

Apply [`supabase/migrations/20261005_city_margins.sql`](supabase/migrations/20261005_city_margins.sql) to the **existing** Supabase project after the Assignment 3 migration. It preserves existing data and can be rerun.

Then apply [`supabase/migrations/20261005_city_margins_budget.sql`](supabase/migrations/20261005_city_margins_budget.sql) to enforce a shared maximum of 100 attempts per UTC day before any provider call. Its private counter increments in the same transaction as the request and survives account deletion. This bounds request volume, not a guaranteed dollar amount; provider pricing and your account’s billing tier still apply.

Finally apply [`supabase/migrations/20261005_city_margins_starters.sql`](supabase/migrations/20261005_city_margins_starters.sql), then [`supabase/migrations/20261005_city_margins_starter_publication.sql`](supabase/migrations/20261005_city_margins_starter_publication.sql). They add server-controlled starter labels and session-specific ownership to the feed without exposing author IDs. Starter labels are assigned in the same transaction that publishes a caption, using admin-controlled account metadata. To populate the three examples, run `node --env-file=.env.local scripts/seed-city-margins.mjs` once with the server variables below. The script creates a dedicated starter account without sending email, uses authenticated quota reservations and real Gemini calls, saves full prompts and outputs, and skips already-completed examples on reruns. Starter votes begin at zero.

| Table | Read access | Mutation access |
| --- | --- | --- |
| `books` | Everyone | No app-client writes |
| `profiles` | Owner only | Owner updates name/photo columns only |
| `generation_requests` | Owner only | Authenticated `reserve_generation`; server-only completion/failure |
| `captions` | Everyone | Server-only `complete_generation` |
| `votes` | Owner only | Authenticated owner inserts/changes/removes their vote |
| `daily_generation_budget` | No app-client reads | Private reservation trigger only |

The migration enables RLS on all application tables in `public`, replaces permissive policies on the five app tables, and restricts table/column grants. Supabase-managed schemas are not rewritten; existing private photo policies remain in effect. Public `get_caption_feed` deliberately returns aggregate counts and only the current viewer’s vote, never voter IDs, profile data, or private source prompts. Its definer function has an empty search path and explicit execution grants.

`reserve_generation` derives ownership from `auth.uid()` and serializes reservations per account. A unique slot constraint adds a hard maximum of **five attempts per UTC day**, including failures. The application cannot delete reservations to reset the limit. A separate server credential can only be reached through server-only code; it completes the reserved result after a real provider response. Users cannot insert fabricated captions or mark pending requests completed. Completion retries are idempotent and never call the AI again. Pending/failed requests never appear in the public feed.

Configure these **server-only** variables in `.env.local` and the existing Vercel project’s Production and Preview environments:

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Key created in Google AI Studio; never expose with `NEXT_PUBLIC_` |
| `GEMINI_MODEL` | Optional, defaults to `gemini-3.5-flash-lite`; choose a compatible model available to your key |
| `SUPABASE_SERVICE_ROLE_KEY` | Completes/fails generation requests only; the session-bound anon client still handles user reads, quota reservations, and voting |

The app sends the full stored system/user prompts to Google’s [generateContent API](https://ai.google.dev/api/generate-content). Only complete, nonempty captions of at most 320 Unicode characters are accepted. Provider errors, rate limits, and timeouts show a retry message without publishing placeholder content. No new SDK or runtime dependency is required.

### Assignment 4 validation

```sh
npm test
npm run lint
npm run build
```

Run [`supabase/tests/city_margins_rls.sql`](supabase/tests/city_margins_rls.sql) and [`supabase/tests/city_margins_budget.sql`](supabase/tests/city_margins_budget.sql) as postgres in a disposable/local Supabase database after both migrations. They create temporary accounts inside transactions, assert anonymous and cross-account restrictions, vote insert/change/remove behavior, score correctness, publication integrity, and both daily quota limits, then roll back all fixtures. These are integration tests, not production seed scripts.

Before submitting the unique deployment URL, verify logged-out browsing, Google sign-in return navigation, one real generation and saved prompts, persistent vote/change/remove behavior, and incognito access. PM feedback and submission to the course portal require the owner’s feedback/session context.

## Existing projects

| Service | Project |
| --- | --- |
| GitHub | [hx2413-maker/hello_world](https://github.com/hx2413-maker/hello_world) |
| Vercel | `hello_world` |
| Production alias | [helloworld-chi-five.vercel.app](https://helloworld-chi-five.vercel.app) |
| Supabase | `dyfntyocuuusnhxphsua` |
| Google Cloud | Reading Room Auth (`fifth-brook-510114-c3`) |

Keep using these projects. The deployment behind the production alias changes when a new production deployment is promoted; the assignment submission should use the unique URL of the verified deployment for the submitted commit.

## App routes and sign-in flow

| Route | Behavior |
| --- | --- |
| `/` | Public homepage |
| `/books` and `/books/[id]` | Public list and book details fetched from Supabase |
| `/margins` and `/margins/[id]` | Public AI caption feed and permalinks; sign in to generate/rate; saved prompts visible only to creator |
| `/login` | Google sign-in; existing sessions continue to profile setup or the member room |
| `/auth/callback` | Exchanges the OAuth code for a session, then checks profile completeness |
| `/profile` | Requires sign-in; edits first name, last name, and an optional photo |
| `/members` | Requires sign-in and both names; shows personalized member content |
| `/privacy` | Public notice explaining sign-in data, profiles, photos, session cookies, and the owner contact |

The header shows Home and Books to everyone, Sign in to guests, and Members, Profile, and Sign out to authenticated users. Protected pages and profile saves verify the user on the server. The Next.js proxy refreshes Supabase session cookies before rendering.

On the first Google sign-in, a database trigger creates the profile with both names `NULL`. The app asks the user to supply the missing names before entering `/members`. Names are deliberately not copied from Google's metadata. Returning users with complete profiles go straight to the member room. A failed profile read opens the profile page's retry state without discarding the session.

## Local environment

Use **Node.js 22.18 or newer** (Vercel uses Node 24). This supports the built-in TypeScript stripping used by the dependency-free unit tests, as well as the installed Supabase client.

```sh
cp .env.example .env.local
npm ci
npm run dev
```

Fill in `.env.local` before starting the app:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | `https://dyfntyocuuusnhxphsua.supabase.co` |
| `SUPABASE_ANON_KEY` | This project's anon key from Supabase settings |
| `SITE_URL` | Optional trusted origin; `http://localhost:3000` locally or the production/custom origin on Vercel |

These are server environment variables; this app does not require `NEXT_PUBLIC_` copies. Keep `.env.local` out of Git. The normal Supabase client uses the anon key with the user’s session; the service-role key is isolated in the generation writer described above. Google OAuth client credentials belong in Supabase's Google provider configuration, not in application source code.

Open [localhost:3000](http://localhost:3000). On Vercel, the app also recognizes the current deployment, branch, and production origins from Vercel's system environment variables so the OAuth callback stays on the host where sign-in started.

## Database and photo storage

Run [`supabase/migrations/20260929_profiles.sql`](supabase/migrations/20260929_profiles.sql) in the **existing** Supabase project's SQL Editor as `postgres`. It supports reruns without replacing profile values or uploaded files. The original [`supabase/schema.sql`](supabase/schema.sql) is the one-time Assignment 2 books setup; do not rerun it against the existing books table.

The migration creates:

- `public.profiles`, keyed to `auth.users.id` with cascading deletion, nullable `first_name` and `last_name`, a nullable `avatar_path`, and timestamps.
- An `AFTER INSERT` trigger on `auth.users` that creates a blank profile, plus a backfill for preexisting accounts.
- Row-level security and limited privileges so users can read and update only their own profile. Client inserts are unnecessary because the trigger creates profiles.
- A private `profile-photos` Storage bucket accepting JPEG, PNG, and WebP files up to 2 MB. Storage policies limit access to the authenticated user's ID folder.

Photo files live in Supabase Storage at `<user-id>/<unique-file-name>`. The relational database stores only the object path, never binary image data. The profile page displays a signed URL valid for one hour. Server validation checks the size, MIME type, and file signature; replacing a photo also attempts to remove the old file.

## Google OAuth configuration

Use the Google Cloud project above to configure the consent screen and a **Web application** OAuth client. For OAuth branding, the app homepage is `https://helloworld-chi-five.vercel.app` and the public privacy notice is `https://helloworld-chi-five.vercel.app/privacy`.

Set the OAuth client's authorized redirect URI to the Supabase callback:

```text
https://dyfntyocuuusnhxphsua.supabase.co/auth/v1/callback
```

Enable Google in Supabase Authentication providers and save that OAuth client's ID and secret. If the Google consent screen is in Testing, add each allowed tester; use an audience configuration that permits the intended assignment reviewer to sign in.

There are two callbacks with different purposes: **Google returns to Supabase's `/auth/v1/callback`; Supabase returns to this app's `/auth/callback`.** The app passes exactly `<current-origin>/auth/callback` as `redirectTo`, without custom query parameters. Supabase supplies the authorization code as part of the completed OAuth flow. See the [Supabase Google sign-in guide](https://supabase.com/docs/guides/auth/social-login/auth-google).

In Supabase Authentication → URL Configuration, use the production alias as Site URL. The configured redirect allowlist is:

```text
https://helloworld-chi-five.vercel.app/auth/callback
https://helloworld-*-random-e654.vercel.app/auth/callback
http://localhost:3000/auth/callback
http://127.0.0.1:3000/auth/callback
```

The deployment pattern is limited to this app's Vercel naming pattern and callback path. If a custom domain or deployment naming pattern changes, update the allowlist and trusted origin configuration. See [Supabase redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls).

## Validate and deploy

```sh
npm run lint
npm run build
```

Use Node 24 in the existing Vercel project's build settings. Set the Supabase and Gemini variables described above in Production and Preview, and set `SITE_URL` to the production alias if needed. Commit and push to the existing GitHub repository to create a deployment. In Vercel project settings, turn off Deployment Protection and wait for the deployment to become Ready.

Complete this checklist against the new deployment's unique URL before submitting it:

- Open the site in an Incognito window without a Vercel login; the homepage and book cards should work.
- Visit `/members` and `/profile` while signed out; both should send you to `/login` without showing private content.
- Sign in with Google as a new user. Confirm return through `/auth/callback`, one new `profiles` row, and the required first/last-name prompt.
- Save both names, enter the member room, then refresh and sign in again to confirm persistence.
- Edit both names and upload a valid photo. Refresh to confirm the photo is stored in Storage and only its path appears in `profiles`.
- Try an oversized or unsupported file and empty names; the form should explain the validation error.
- Sign out and revisit a protected URL; the app should require sign-in again.
- Verify another account cannot read or change the first user's profile or photo.
- Check the deployment's Git commit matches the pushed commit, then copy its unique URL for the assignment submission.

This README describes the implementation and deployment procedure; live OAuth and the final deployment should be considered verified only after completing those checks. Submission is left to the repository owner.
