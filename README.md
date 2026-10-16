# City Margins

A standalone Columbia and NYC meme-generation and rating app, built with Next.js, Supabase Auth/Postgres/Storage, and Gemini. Anyone can browse. Signed-in users create memes and vote on other users’ work.

## PM feedback implemented

- Removed the book catalog, member room, profile onboarding, and their active backend dependencies. Sign-in returns directly to the meme feed or the meme the visitor was viewing.
- Rebuilt the interface around large meme cards, prominent up/down votes, New/Top tabs, sharing, and a compact creation panel. Design research: [Imgflip’s feed](https://imgflip.com/m/fun), [Memedroid](https://www.memedroid.com/), and [9GAG](https://9gag.com/). The app uses its own branding and Columbia-blue palette.
- Retained text-idea generation with witty, poetic, and deadpan tones. Added uploaded-image generation: Gemini inspects the actual image and writes a caption tied to a visible detail and Columbia/NYC life. The result displays as a caption above the source image, rather than claiming that the uploaded image itself was AI generated.
- Added an optional meme profile at `/profile`: edit a display name, preview and replace an avatar, or remove it. Saved names and avatars appear beside the user's memes. Google account details are never automatically published, and profile setup does not interrupt sign-in.
- Author names and avatars open `/members/[id]`, a public creator profile with their published memes and total received upvotes. The header Profile link opens your public page; Edit profile opens the existing name/avatar settings. Creators can delete their own memes from their profile or meme detail page after confirming.

## Product choices for Sam

A shared daily prompt rotates through campus, dorm, subway, and low-budget weekend situations. It gives a student new to NYC a quick starting point and a reason to return. New lets fresh contributions get exposure; Top ranks community votes. Permanent meme links make posts easy to share. Visible AI labels, real saved prompts, and the image preview make generation more understandable. Image recognition improves on a generic caption generator by making the joke respond to the picture’s actual details.

The image demo uses [a CC0 pigeon photograph by RobertKixmiller](https://commons.wikimedia.org/wiki/File:Pigeon_Walking_Across_The_Sidewalk_051120231.jpg), remixed with an AI caption; the source photo is not represented as a NYC photograph.

The feed includes genuinely AI-generated starter posts from a separate account, clearly labeled as starters. Vote totals reflect stored votes; no fake activity is seeded. No comments, follower counts, or popularity numbers are fabricated.

## Data and access

| Data | Read | Write |
| --- | --- | --- |
| `captions` | Public, including vote aggregates | Server-only completion RPC; authenticated authors may delete their own non-starter memes through RLS |
| `generation_requests` | Request owner only | Authenticated reservation RPC; server-only completion/failure |
| `votes` | Owner’s individual rows; public aggregate counts | Authenticated owner only, one vote per caption |
| `daily_generation_budget` | No app-client access | Private database quota enforcement |
| `member_profiles` | Direct rows owner-only; narrow public RPCs expose chosen name/avatar, meme count and aggregate upvotes | Authenticated owner inserts or edits their own name/avatar; ownership cannot change |
| `member-avatars` storage | Owner; public signed reads for a public profile’s selected avatar | Owner only, one fixed WebP object per account, up to 2 MiB |
| `meme-images` storage | Published images public through RLS-approved signed URLs; unpublished images owner-only | Owner uploads only to a reserved pending request; no overwrite; owner cleanup allowed after its completed meme is deleted |

RLS is enabled on all application tables. The legacy tables move to a non-exposed, locked archive schema; all application grants and profile-photo policies are removed. Supabase-managed internal tables are left under Supabase’s own controls.

The first vote inserts a row associated with both the authenticated user and caption. Changing a vote updates it; clicking the selected vote removes it. The database enforces ownership independently of the UI. Generation has five attempts per user per UTC day and a shared 100-attempt daily ceiling. Failed model calls count toward the limit.

Deleting a meme removes its public caption and cascades its votes in one database transaction. The server then attempts owner-authorized image cleanup. The private generation request is retained for audit and quota enforcement, so deleting a meme does not restore generation attempts. Starter posts and other users’ posts cannot be deleted by app users. Public profiles show upvotes on currently published memes and never disclose account emails, private prompts, or individual voters.

The public feed uses three thumbnail columns on desktop and the original single-column cards on mobile. The daily idea appears above the feed. Creation lives at `/create`, which requires sign-in; `/create?prompt=today` pre-fills the daily idea and is preserved through Google login.

Meme uploads accept JPEG, PNG, WebP, and GIF up to 2 MiB and 20 megapixels per frame. The server rejects format spoofing, strips metadata, and resizes still images to at most 1600 × 1600 before encoding WebP. GIF and WebP animations retain their frames and timing in the published WebP, with limits of 120 frames, 15 seconds, 60 million decoded pixels, and an 800 × 800 output bound. Gemini receives up to three independently encoded still frames in chronological order. The exact system/user prompts (including the animation sampling instruction), tone, model, and token usage are saved. Pending or failed media stay private to their owner. The composer explains that successful memes become public and images are sent to Google Gemini.

The service-role key is isolated in a server-only module used only for completion/failure RPCs. Reads, image uploads, reservations, and votes use the signed-in session and RLS. Provider keys never reach browser JavaScript.

Avatar uploads remain static JPEG, PNG, or WebP, with image decoding, format validation, and metadata stripping, then crop to a 256 × 256 WebP. They are not sent to Gemini. Profile mutations use the user's session, never the service key. Removing an avatar clears the public reference; its single stored object remains private until the next upload overwrites it. Previously signed links expire after five minutes.

## Local development

Use Node 22.18+ (Vercel uses Node 24). Copy `.env.example` to `.env.local` and set:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — server-only
- `GEMINI_API_KEY` — server-only
- Optional `GEMINI_MODEL`, default `gemini-3.5-flash-lite`

```sh
npm ci
npm run dev
npm test
npm run lint
npm run build
```

Visit `/margins`. `/` redirects to the feed. `/margins/[id]` is the share page; `/members/[id]` is a public creator page; `/profile` manages the signed-in user's meme identity; `/login`, `/auth/callback`, and `/privacy` support them. Legacy book routes and mandatory profile onboarding are removed.

## Database rollout

Historical migrations remain unchanged as an audit trail. Existing production already has the October 5 generation, quota, starter, and voting migrations.

1. Apply `supabase/migrations/20261012_city_margins_images.sql` before deploying this version. It is additive and preserves text-only posts and their links.
2. Deploy the new application, then confirm sign-in and creation work without profile onboarding.
3. Apply `supabase/post-deploy/20261012_archive_reading_room.sql` only after the new version is live. It removes obsolete triggers and API access while retaining old records and files in a locked archive for recovery. It does not delete accounts, captions, votes, or generation history.
4. Apply `supabase/migrations/20261012210356_city_margins_member_profiles.sql` to add optional meme profiles before deploying the profile editor. The CLI uses 14-digit timestamps while the older files use 8-digit dates: follow this explicit order, not a lexical filename sort.
5. Apply `supabase/migrations/20261012211830_restore_feed_author_profiles.sql` last. It repairs deployments whose feed function still has the pre-profile return columns, which hides saved names and avatars on existing memes. It changes no profile, image, caption, or vote data. Verify the live RPC includes `author_name`, `author_avatar_path`, and `author_updated_at`; checking only migration history is insufficient.
6. Apply `supabase/migrations/20261016160937_city_margins_public_profiles.sql` before deploying public creator pages. It adds the narrow profile summary, author-filtered feed and ownership-based caption DELETE policy. Existing four-argument feed calls remain compatible. Run `supabase/tests/city_margins_public_profiles.sql` to verify anonymous/cross-user denial, deletion cascades, profile counts, and quota retention; all its fixtures roll back without modifying real users or stored media.

For a new empty database, apply the historical schema/migrations in chronological order, then the image migration and archive cleanup. SQL security checks are in `supabase/tests/` and should run in a disposable Postgres fixture, never against production. Image and authentication boundary tests run via `npm test`.

## Deployment and acceptance

Vercel project: `hello_world`. Configure the server environment for both Production and Preview. The existing Google OAuth callback allowlist includes localhost, the production alias, and this project’s immutable Vercel deployment hosts. Deployment protection must remain disabled for incognito access.

Acceptance checks:

- Signed-out visitors browse memes and images but must sign in to create or vote.
- Google sign-in returns to the requested meme/feed with no name/profile form.
- The Profile link opens the public creator page with accurate published-meme and upvote totals. Clicking any meme author opens that author’s profile. Edit profile opens name/avatar settings. Changes persist after refresh and update existing cards and creator pages. Cross-user profile/avatar changes are denied.
- Only owners see deletion controls on their profile and meme detail pages. Cancel preserves the meme; confirmed deletion removes it and its votes from the feed, detail page and profile totals. Direct anonymous or cross-user deletion is denied by the database. Private generation history and quota usage remain intact.
- Text generation preserves all three tones.
- An image-only submission (no descriptive prompt) generates a caption grounded in visible image details and Columbia/NYC life, saves the image and exact prompts, and appears in the public feed.
- A second user can vote; the first vote creates a row, refresh preserves it, and toggling removes it.
- Unauthorized reads/writes, another user’s private image access, invalid uploads, and quota overages are rejected.
- New/Top, mobile layout, share links, owner prompt details, and failed-generation states work.
- Public legacy routes are gone; legacy tables/policies are absent from the active API.

Submit the **immutable deployment URL tied to the final commit**, not only the moving production alias. The course Submissions action is performed by the student.
