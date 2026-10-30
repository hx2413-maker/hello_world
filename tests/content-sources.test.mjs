import assert from "node:assert/strict";
import test from "node:test";
import { imageMimeFromBytes, parseCampusNews, parseMemeTemplates, plainSourceText, readBoundedBody, safeCampusNewsUrl, safeTemplateUrl } from "../src/lib/content-sources.ts";

test("template catalog rejects unexpected URLs, duplicate IDs, bad dimensions, and unbounded labels", () => {
  const good = { id: "181913649", name: "Drake &amp; Friends", url: "https://i.imgflip.com/30b1gx.jpg", width: 1200, height: 1200 };
  const parsed = parseMemeTemplates({ success: true, data: { memes: [good, good, { ...good, id: "2", url: "http://127.0.0.1/private" }, { ...good, id: "3", width: 30000 }, { ...good, id: "4", url: "https://i.imgflip.com@evil.test/a.jpg" }, { ...good, id: "5", width: 2.5 }] } });
  assert.deepEqual(parsed, [{ ...good, name: "Drake & Friends" }]);
  assert.deepEqual(parseMemeTemplates({ success: false }), []);
  assert.equal(safeTemplateUrl("https://i.imgflip.com/abc.jpg?redirect=http://localhost"), null);
  assert.equal(safeTemplateUrl("https://i.imgflip.com.evil.test/abc.jpg"), null);
  assert.equal(safeTemplateUrl("https://i.imgflip.com/a.svg"), null);
});

test("Columbia highlights are parsed as data with bounded dates and allowlisted source URLs", () => {
  const now = new Date("2026-10-30T15:00:00Z");
  const recent = { label: "Campus &amp; Community <b>Day</b>", link: "https://news.columbia.edu/news/campus-day?utm_source=email", dateStart: "1793287249", category: "Campus &amp; Community" };
  const html = `<script>var highlights_data = ${JSON.stringify([recent, recent, { ...recent, link: "https://evil.test/news/campus" }, { ...recent, link: "/news/old", dateStart: "100" }, { ...recent, link: "/news/future", dateStart: "2000000000" }])};</script>`;
  const parsed = parseCampusNews(html, now);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].title, "Campus & Community Day");
  assert.equal(parsed[0].url, "https://news.columbia.edu/news/campus-day");
  assert.equal(parsed[0].category, "Campus & Community");
  assert.deepEqual(parseCampusNews('<script>var highlights_data = [alert("executed")];</script>', now), []);
  assert.deepEqual(parseCampusNews("<html>Source changed its format</html>", now), []);
  assert.equal(safeCampusNewsUrl("//evil.test/news/a"), null);
  assert.equal(safeCampusNewsUrl("javascript:alert(1)"), null);
  assert.equal(safeCampusNewsUrl("https://news.columbia.edu.evil.test/news/a"), null);
});

test("source text strips control characters and handles bad numeric entities safely", () => {
  assert.equal(plainSourceText("<b>Campus</b> &amp; &#x1F600; &#99999999; \u202e", 100), "Campus & 😀");
  assert.equal(plainSourceText("x".repeat(500), 80).length, 80);
});

test("dated official article teasers survive a changed highlight script without executing markup", () => {
  const now = new Date("2026-10-30T15:00:00Z");
  const article = (url, date, title) => `<article about="${url}" typeof="schema:Article"><div class="field field--name-field-cu-date field--type-datetime">${date}</div><h2><a href="${url}" rel="bookmark"><span property="schema:name">${title}</span></a></h2></article>`;
  const html = '<script>var highlights_data = [notJSON];</script>'
    + article("/news/campus-day", "October 29, 2026", "Campus &amp; Community Day")
    + article("https://evil.test/news/campus", "October 29, 2026", "Wrong origin")
    + article("/news/stale", "January 1, 2025", "Old story");
  assert.deepEqual(parseCampusNews(html, now), [{ title: "Campus & Community Day", url: "https://news.columbia.edu/news/campus-day", publishedAt: "2026-10-29T12:00:00.000Z", category: "Campus News" }]);
});

test("bounded response reader rejects both declared and streamed oversized bodies", async () => {
  await assert.rejects(readBoundedBody(new Response("abc", { headers: { "content-length": "9999999" } }), 10), /size limit/);
  const streaming = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(6)); controller.enqueue(new Uint8Array(6)); controller.close(); } });
  await assert.rejects(readBoundedBody(new Response(streaming), 10), /size limit/);
  assert.deepEqual(await readBoundedBody(new Response("hello"), 10), new TextEncoder().encode("hello"));
});

test("image signature must match an actual supported raster format", () => {
  assert.equal(imageMimeFromBytes(new TextEncoder().encode('<svg width="500">')), null);
  assert.equal(imageMimeFromBytes(new TextEncoder().encode("GIF89a123456789")), "image/gif");
  assert.equal(imageMimeFromBytes(new TextEncoder().encode("RIFF1234WEBPextra")), "image/webp");
});
