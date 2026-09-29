# Hello World — The Reading Room

Assignment 3 extends the same Next.js app and Supabase reading list from Assignments 1 and 2. It adds Google sign-in, automatic profile creation, required name completion, editable profiles with photo uploads, and a protected member reading room.

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
| `/login` | Google sign-in; existing sessions continue to profile setup or the member room |
| `/auth/callback` | Exchanges the OAuth code for a session, then checks profile completeness |
| `/profile` | Requires sign-in; edits first name, last name, and an optional photo |
| `/members` | Requires sign-in and both names; shows personalized member content |
| `/privacy` | Public notice explaining sign-in data, profiles, photos, session cookies, and the owner contact |

The header shows Home and Books to everyone, Sign in to guests, and Members, Profile, and Sign out to authenticated users. Protected pages and profile saves verify the user on the server. The Next.js proxy refreshes Supabase session cookies before rendering.

On the first Google sign-in, a database trigger creates the profile with both names `NULL`. The app asks the user to supply the missing names before entering `/members`. Names are deliberately not copied from Google's metadata. Returning users with complete profiles go straight to the member room. A failed profile read opens the profile page's retry state without discarding the session.

## Local environment

Use **Node.js 22 or newer**. The installed `@supabase/supabase-js` version requires Node `>=22.0.0`.

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

These are server environment variables; this app does not require `NEXT_PUBLIC_` copies. Keep `.env.local` out of Git and use the anon key, never a service-role key. Google client credentials belong in Supabase's Google provider configuration, not in application source code.

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

Use Node 22 or newer in the existing Vercel project's build settings. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in Production and Preview, and set `SITE_URL` to the production alias if needed. Commit and push to the existing GitHub repository to create a deployment. In Vercel project settings, turn off Deployment Protection and wait for the deployment to become Ready.

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
