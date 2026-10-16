import assert from "node:assert/strict";
import test from "node:test";
import { getPostSignInPath, getSafeAuthNext } from "../src/lib/auth-next.ts";

const caption = "/margins/603ed48d-2232-43be-ae89-aa1f762a73e2";

test("returns the meme feed by default and admits the feed, profile, or a caption UUID", () => {
  assert.equal(getSafeAuthNext("/margins"), "/margins");
  assert.equal(getSafeAuthNext(caption), caption);
  assert.equal(getSafeAuthNext("/profile"), "/profile");
  assert.equal(getPostSignInPath("/profile"), "/profile");
  assert.equal(getPostSignInPath(undefined), "/margins");
  assert.equal(getPostSignInPath(caption), caption);
  assert.equal(getPostSignInPath("/margins"), "/margins");
});
test("returns creators to the studio and preserves only the exact daily-idea destination", () => {
  for (const path of ["/create", "/create?prompt=today"]) {
    assert.equal(getSafeAuthNext(path), path);
    assert.equal(getPostSignInPath(path), path);
  }
});
test("blocks open redirects, ambiguous paths, encodings, fragments and unexpected form values", () => {
  const invalid = [
    undefined, null, 1, ["/margins"], { next: "/margins" }, new Blob(["/margins"]),
    "", "https://example.com/margins", "//example.com/margins", "\\\\example.com\\margins",
    "/margins//example.com", "/margins/../members", "/margins/../../example.com", "/members", "/profile/", "/profile?next=https://example.com", "/auth/callback",
    "/margins/", "/margins-fake", "/MARGINS", "/MARGINS/603ed48d-2232-43be-ae89-aa1f762a73e2", "/margins/not-a-uuid",
    "/margins?next=https://example.com", "/margins#caption-studio", "/margins%2f%2fexample.com", "%2Fmargins", "%252Fmargins",
    "/create/", "/create?", "/create?prompt=other", "/create?prompt=TODAY", "/create?prompt=%74oday", "/create?prompt=today&next=https://example.com",
    "/create?prompt=today&prompt=today", "/create?next=https://example.com", "/create?prompt=today#form", "/create#form", "%2Fcreate", "/CREATE", "/create\n", "/create?prompt=today\n",
    "/margins\n", " /margins", "/margins ", "/margins\u0000", `${caption}/extra`, `${caption}?sort=top`, `${caption}\n`, `${caption}\r\n`, `${caption}\u0000`,
  ];
  for (const value of invalid) {
    assert.equal(getSafeAuthNext(value), null, `Unexpected destination accepted: ${String(value)}`);
    assert.equal(getPostSignInPath(value), "/margins");
  }
});
