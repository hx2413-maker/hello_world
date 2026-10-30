# Campus Margins

A Columbia campus-life meme app built with Next.js, Supabase Auth/Postgres/Storage, and Google Gemini. Anyone can browse and try the private practice experience. Signed-in members publish AI captions, vote, share reusable tones, and manage their profiles and memes.

## Current experience

- **Campus first.** The name, interface, starter ideas, and AI instructions focus on dorms, Butler, the Core, dining halls, clubs, exams, and everyday Columbia life. Existing member posts remain intact.
- **A browsable feed.** Three meme columns on desktop, single-column cards on mobile, New/Top sorting, persistent up/down votes, and permanent share links. AI captions and starter posts are labeled; vote totals come from real database rows.
- **A separate studio at `/create`.** Start with text, a photo/GIF, or a popular meme template. Gemini inspects the actual image; the result pairs an AI caption with the source media. The uploaded image itself is not presented as AI generated.
- **Custom and community tones.** Use Witty, Poetic, or Deadpan, describe a custom style, or save a named tone for other members. Up to 20 saved tones per account; only the creator can remove one. Existing generations retain their exact tone and prompts after removal.
- **An image library at `/templates`.** Search popular templates from Imgflip's public API, then carry the selected image through Google sign-in into the studio. The catalog refreshes weekly and credits its source.
- **Current campus inspiration.** Columbia News supplies dated, linked campus headlines for the daily idea. Scheduled refresh runs daily, with six-hour cache revalidation between runs. When campus news is unavailable, Nager.Date supplies an upcoming U.S. public holiday with a campus-life prompt; its attribution makes clear that this is not Columbia's class schedule. If both sources are unavailable, the feed labels a rotating campus fallback. This is inspiration, not an AI news report.
- **Campus helper.** A chat assistant offers safe navigation links or prepares a campus meme proposal. Signed-in users review a proposal and choose **Generate & publish** in chat, or edit it in the studio. The assistant cannot vote, delete content, edit accounts, or fetch arbitrary URLs.
- **Practice at `/demo`.** Visitors can rate examples without signing in and try one image-caption preview per browser. Practice votes stay on the page and never affect community totals. The preview is private and never published.
- **Creator profiles.** Names and avatars open `/members/[id]`, showing published memes and total received upvotes. `/profile` edits the member's chosen name/avatar. Owners can delete their own non-starter memes after confirmation.

The design retains the app's blue palette and generated logo. Campus context, template reuse, current ideas, and reusable tones provide reasons to return without fabricated activity. The earlier image-recognition example used [RobertKixmiller's CC0 pigeon photograph](https://commons.wikimedia.org/wiki/File:Pigeon_Walking_Across_The_Sidewalk_051120231.jpg); its source was not represented as a NYC photograph.

## Data and access

| Data | Read | Write |
| --- | --- | --- |
| `captions` | Public, including aggregate scores | Server completion RPC; authenticated authors may delete their own non-starter memes |
| `generation_requests` | Request owner only | Authenticated reservation RPC; server-only completion/failure |
| `votes` | Owner's individual rows; public aggregate counts | Authenticated owner only, one row per caption |
| `daily_generation_budget` | No app-client access | Private database quota enforcement |
| `member_profiles` | Direct rows owner-only; narrow public name/avatar/count RPCs | Owner only; ownership cannot change |
| `shared_tones` | Public styles and creator IDs | Signed-in owner inserts/removes; saved styles are immutable |
| Private `assistant_requests` and `demo_requests` | Server only | Server-only metering/completion RPCs |
| `member-avatars` storage | Owner; short-lived signed reads for the selected public avatar | Owner only, one fixed WebP object per account |
| `meme-images` storage | Published images through RLS-approved signed URLs; unpublished images owner-only | Owner upload against a reserved pending request; no overwrite; cleanup after deletion |

RLS is enabled on application tables, including private request tables. Legacy reading-room tables live in a locked, non-exposed archive; old routes and active dependencies are removed. Supabase-managed internal tables remain under Supabase's own controls.

The first community vote inserts a row tied to the authenticated account and caption. Switching updates it; clicking again removes it. Published generation allows five attempts per account and 100 shared attempts per UTC day, including failed model calls. Database checks enforce these rules independently of the UI.

Deleting a meme removes its caption and votes in one transaction, then attempts owner-authorized image cleanup. Its private generation record and spent quota remain. Public profiles never expose account emails, private prompts, or individual voters. Google account names/photos are not automatically published.

The service-role key is confined to server-only capabilities for generation completion/failure and private assistant/demo metering. Ordinary member reads, uploads, generation reservations, profile changes, shared tones, and votes use the member's session and RLS. Provider keys never reach browser JavaScript.

## Media and AI limits

Meme uploads accept JPEG, PNG, WebP, and GIF up to 2 MiB. The server validates actual image bytes, rejects spoofing, and strips metadata. Still images are bounded to 20 megapixels and resized to at most 1600 × 1600. GIF/WebP animations retain timing and frames in the published WebP, bounded to 120 frames, 15 seconds, 60 million decoded pixels, and 800 × 800 output. Gemini receives up to three sampled frames in order. Published generations save exact system/user prompts, tone, model, and token usage.

Template downloads accept only catalog IDs resolved to exact `i.imgflip.com` URLs, reject redirects, and enforce the 2 MiB input limit before the normal decoder. Source text is parsed as data, never executable code or privileged AI instructions. Avatars remain static JPEG/PNG/WebP, cropped to 256 × 256 WebP and never sent to Gemini. Removing an avatar clears its public reference; old signed links expire after five minutes.

The assistant allows 20 requests per account and 100 shared requests per UTC day. Chat messages go to Gemini but are not stored in the app database; request identity/time are retained for quotas. A proposed meme publishes only after the member presses **Generate & publish**, using the normal studio quota.

Guest previews allow one attempt per signed browser identity, three per network per UTC day, and 20 shared attempts per UTC day. Failed generation attempts count. A signed HTTP-only cookie lasts up to one year; guest and network identifiers are hashed. The preview image is processed in memory, not stored or published. The prompt, caption, model, status, and timestamp remain in a private usage record. The demo creates no anonymous Supabase accounts and casts no real votes. See `/privacy` for the user-facing explanation.

## Local development

Use Node 22.18+ (the deployment uses Node 24). Copy `.env.example` to `.env.local` and configure Supabase and Gemini. `CAMPUS_GUEST_SECRET` must be a random secret of at least 32 characters; keep it stable across releases. `CRON_SECRET` secures scheduled content refreshes. Keep all secrets server-only and out of Git. `GEMINI_MODEL` is optional and defaults to `gemini-3.5-flash-lite`.

```sh
npm ci
npm run dev
npm test
npm run lint
npm run build
```

Routes: `/margins` (feed), `/margins/[id]` (meme), `/create` (protected studio), `/templates` (library), `/demo` (practice), `/members/[id]` (creator), `/profile` (protected settings), `/login`, and `/privacy`. `/` redirects to the feed. Safe creation drafts, templates, and today's idea survive sign-in.

## Database rollout

Historical migrations remain an audit trail. Older migrations use eight-digit dates and newer ones use 14-digit timestamps, so do not rely on lexical filename order. After the historical profile schema and October 5 caption/quota/vote migrations, apply:

1. `20261012_city_margins_images.sql` — image generation and storage.
2. `20261012210356_city_margins_member_profiles.sql` — chosen profiles.
3. `20261012211830_restore_feed_author_profiles.sql` — feed author columns; verify the live RPC, not only migration history.
4. `20261016160937_city_margins_public_profiles.sql` — creator pages, author-filtered feed, owner deletion.
5. `20261030135826_campus_shared_tones.sql` — reusable tones and custom generation labels while preserving quotas.
6. `20261030140021_campus_assistant_demo_limits.sql` — private assistant/demo metering and server-only RPCs.

Apply both October 30 migrations before deploying their app features. The earlier `supabase/post-deploy/20261012_archive_reading_room.sql` cleanup belongs after the app no longer uses reading-room routes; it archives old access without deleting accounts, memes, votes, or generation history. For a new database, apply the historical schema/migrations in dependency order, followed by later migrations and the appropriate archive cleanup.

Use a disposable database for initial migrations and full historical SQL testing. The public-profile, shared-tone, and assistant/demo suites in `supabase/tests/` create randomly identified fixtures inside an explicit transaction and end with `ROLLBACK`; they do not intentionally modify real users or media. When verifying one against an existing project, run the complete transaction in one connection, stop on errors, and roll back or close the connection after failure. Concurrent traffic can affect shared-quota/count assertions. Do not assume every historical test file is production-safe without reviewing it.

`npm test` covers authentication return paths, creation drafts, AI output parsing, image/animation validation, profiles, custom tones, source boundaries, assistant action restrictions, and signed guest identities. SQL suites separately exercise RLS, ownership, quotas, and private/public data separation.

## Scheduled content and deployment

Vercel project: `hello_world`. Configure server variables for Production and Preview. Set `CRON_SECRET` in Production so Vercel can authenticate the refresh endpoint. `vercel.json` schedules campus news/holiday inspiration daily at 11:00 UTC and Imgflip templates on Monday at 12:00 UTC. Timing is approximate on Hobby. The campus refresh succeeds if either news or holiday data is available; if both fail, it returns a failure while pages show the labeled built-in fallback. Columbia News currently denies Vercel requests with HTTP 403, so production uses the public holiday source without bypassing that restriction. See [content source operations](docs/content-sources.md) for source/cache details.

Keep Google OAuth callback hosts and Supabase redirect URLs configured for localhost, the production alias, and authorized immutable deployment hosts. Deployment protection must remain disabled for incognito access.

Before submitting, verify signed-out browsing/practice, Google login/logout, image/template generation, custom tone save/reuse, persistent cross-user voting, creator totals, owner-only deletion, assistant navigation/generation, mobile layout, refresh authorization, and provider failure states. Submit an **immutable deployment URL tied to the final commit**, not only the moving production alias. The student performs the course submission.
