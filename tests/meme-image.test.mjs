import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { normalizeMemeImage, ImageValidationError, MAX_IMAGE_BYTES } from "../src/lib/meme-image.ts";

test("decodes uploads into bounded WebP and removes embedded metadata", async () => {
  const original = await sharp({ create: { width: 2200, height: 1000, channels: 3, background: "#75b2dd" } })
    .withMetadata({ density: 300 }).jpeg().toBuffer();
  const result = await normalizeMemeImage(new File([original], "campus.jpg", { type: "image/jpeg" }));
  const metadata = await sharp(result).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 1600);
  assert.ok(metadata.height <= 1600);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.xmp, undefined);
  assert.ok(result.length <= MAX_IMAGE_BYTES);
});

test("rejects MIME spoofing, SVG, truncated bytes, empty files, and oversized uploads", async () => {
  const png = await sharp({ create: { width: 5, height: 5, channels: 3, background: "red" } }).png().toBuffer();
  const inputs = [
    new File([png], "fake.jpg", { type: "image/jpeg" }),
    new File(['<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'], "fake.png", { type: "image/png" }),
    new File([png.subarray(0, 20)], "broken.png", { type: "image/png" }),
    new File([], "empty.png", { type: "image/png" }),
    new File([Buffer.alloc(MAX_IMAGE_BYTES + 1)], "huge.png", { type: "image/png" }),
    new File([png], "wrong.svg", { type: "image/svg+xml" }),
  ];
  for (const file of inputs) await assert.rejects(normalizeMemeImage(file), ImageValidationError);
});

test("rejects compressed images whose decoded dimensions exceed the pixel budget", async () => {
  const original = await sharp({ create: { width: 5000, height: 4001, channels: 3, background: "white" } }).png().toBuffer();
  assert.ok(original.length < MAX_IMAGE_BYTES);
  await assert.rejects(normalizeMemeImage(new File([original], "large.png", { type: "image/png" })), ImageValidationError);
});
