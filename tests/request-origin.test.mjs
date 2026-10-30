import assert from "node:assert/strict";
import test from "node:test";
import { isSameOrigin } from "../src/lib/request-origin.ts";

const request = (origin, host, url = "https://internal-next.example/demo", extra = {}) => new Request(url, {
  method: "POST", headers: { ...(origin === null ? {} : { origin }), ...(host === null ? {} : { host }), ...extra },
});

test("mutation origin uses the actual Host when Next canonicalizes localhost URLs", () => {
  assert.equal(isSameOrigin(request("http://127.0.0.1:3000", "127.0.0.1:3000", "http://localhost:3000/api/demo/session")), true);
  assert.equal(isSameOrigin(request("https://helloworld-chi-five.vercel.app", "helloworld-chi-five.vercel.app")), true);
  assert.equal(isSameOrigin(request("http://[::1]:3000", "[::1]:3000", "http://localhost:3000/demo")), true);
});

test("mutation origins reject cross-site, malformed, downgraded, and forwarded-host requests", () => {
  for (const origin of [null, "null", "https://evil.example", "http://campus.example", "https://campus.example:444", "https://campus.example/", "https://campus.example#x", "https://user@campus.example"]) {
    assert.equal(isSameOrigin(request(origin, "campus.example")), false, String(origin));
  }
  for (const host of [null, "", "campus.example/evil", "evil@campus.example", "campus.example?x", "campus.example\\evil", "campus.example:invalid", "[::1", "campus.example:99999"]) {
    assert.equal(isSameOrigin(request("https://campus.example", host)), false, String(host));
  }
  assert.equal(isSameOrigin(request("https://evil.example", "campus.example", undefined, { "x-forwarded-host": "evil.example" })), false);
});
