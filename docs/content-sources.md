# Campus content sources

The app uses two public, read-only sources. No source account or paid API key is required.

| Feature | Source | Refresh |
| --- | --- | --- |
| Template library | [Imgflip's documented `get_memes` API](https://imgflip.com/api) | Weekly on Monday at 12:00 UTC; the cached catalog also expires after seven days |
| Campus idea | [Columbia News](https://news.columbia.edu/) | Daily at 11:00 UTC; the cached source also revalidates after six hours |

`vercel.json` schedules both requests against `/api/refresh-content`. Set a random server-only `CRON_SECRET` in the Vercel Production environment. Vercel automatically sends it in the `Authorization: Bearer …` header. The handler rejects requests if the secret is missing or incorrect. Local testing may use the same variable in `.env.local`; never commit it. The schedules fit Vercel Hobby's once-per-day maximum frequency per job. Exact execution time can vary within the scheduled hour.

The refresh handler expires the appropriate Next.js Data Cache tag and requests the source again. A failed provider request returns 502 to make the failure visible in cron logs; the page uses its normal fallback. Cache-based refresh is also available on page visits, so the application still works between scheduled runs. The template gallery shows the upstream response's date, when available, as its catalog snapshot date, not a claim of real-time popularity.

Columbia's homepage currently publishes a `highlights_data` JSON array with headline, category, article URL, and publication timestamp. The implementation parses that JSON without executing its enclosing script. This was checked against the live page on October 30, 2026. The `/rss.xml` path currently serves the homepage rather than a feed, so it is intentionally not used. Only articles from `news.columbia.edu`, no more than 21 days old, are eligible. Campus & Community stories take priority, followed by University News, Photo of the Week, and Office Hours. The prompt links to the original story and exposes publication and retrieval dates. If the source fails, changes format, or has no eligible story, the app labels a built-in campus idea as a fallback.

Template images are loaded only from exact `i.imgflip.com` URLs returned by the catalog. The generator receives a template ID, never a client-provided download URL. Server downloads reject redirects, unsupported MIME types, mismatched raster signatures, and streamed bodies over 2 MiB. The normal meme image decoder still validates dimensions, animation limits, and image content before sending sanitized media to Gemini. The library credits Imgflip and links back to its catalog.

Relevant verification: `node --test tests/content-sources.test.mjs` covers source URL boundaries, malformed provider data, source dates, response size limits, and raster signatures. A cold source request times out after 3.5 seconds for campus news or 5 seconds for the template catalog.
