import assert from "node:assert/strict";
import test from "node:test";
import { getPostSignInPath, getSafeAuthNext } from "../src/lib/auth-next.ts";

const caption = "/margins/603ed48d-2232-43be-ae89-aa1f762a73e2";

test("returns the meme feed by default and admits only the feed or a caption UUID", () => {
  assert.equal(getSafeAuthNext("/margins"), "/margins");
  assert.equal(getSafeAuthNext(caption), caption);
  assert.equal(getPostSignInPath(undefined), "/margins");
  assert.equal(getPostSignInPath(caption), caption);
  assert.equal(getPostSignInPath("/margins"), "/margins");
});
test("blocks open redirects, ambiguous paths, encodings, fragments and unexpected form values", () => {
  const invalid = [
    undefined, null, 1, ["/margins"], { next: "/margins" }, new Blob(["/margins"]),
    "", "https://example.com/margins", "//example.com/margins", "\\\\example.com\\margins",
    "/margins//example.com", "/margins/../members", "/margins/../../example.com", "/members", "/profile", "/auth/callback",
    "/margins/", "/margins-fake", "/MARGINS", "/MARGINS/603ed48d-2232-43be-ae89-aa1f762a73e2", "/margins/not-a-uuid",
    "/margins?next=https://example.com", "/margins#caption-studio", "/margins%2f%2fexample.com", "%2Fmargins", "%252Fmargins",
    "/margins\n", " /margins", "/margins ", "/margins\u0000", `${caption}/extra`, `${caption}?sort=top`, `${caption}\n`, `${caption}\r\n`, `${caption}\u0000`,
  ];
  for (const value of invalid) {
    assert.equal(getSafeAuthNext(value), null, `Unexpected destination accepted: ${String(value)}`);
    assert.equal(getPostSignInPath(value), "/margins");
  }
});
