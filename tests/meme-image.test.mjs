import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { normalizeMemeImage, prepareMemeUpload, ImageValidationError, MAX_IMAGE_BYTES } from "../src/lib/meme-image.ts";

async function makeGif({ width = 30, height = 20, colors = ["#ff0000", "#00ff00", "#0000ff"], delay = [100, 200, 300] } = {}) {
  const frames = await Promise.all(colors.map((background) =>
    sharp({ create: { width, height, channels: 3, background } }).png().toBuffer()));
  return sharp(frames, { join: { animated: true } })
    .gif({ loop: 2, delay, keepDuplicateFrames: true }).toBuffer();
}

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

test("keeps JPEG, PNG, and static WebP compatible with the meme upload path", async () => {
  for (const format of ["jpeg", "png", "webp"]) {
    const original = await sharp({ create: { width: 80, height: 40, channels: 4, background: "#75b2dd" } })
      .toFormat(format).toBuffer();
    const result = await prepareMemeUpload(new File([original], `campus.${format}`, { type: `image/${format}` }));
    assert.equal(result.animated, false);
    assert.equal(result.frames.length, 1);
    assert.deepEqual(result.frames[0], result.media);
    const metadata = await sharp(result.media).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 80);
    assert.equal(metadata.height, 40);
  }
});

test("preserves actual GIF frames and timing in published WebP while giving AI separate stills", async () => {
  const original = await makeGif({ width: 900, height: 450 });
  const result = await prepareMemeUpload(new File([original], "campus.gif", { type: "image/gif" }));
  const metadata = await sharp(result.media, { animated: true }).metadata();
  assert.equal(result.animated, true);
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.pages, 3);
  assert.equal(metadata.width, 800);
  assert.equal(metadata.pageHeight, 400);
  assert.equal(metadata.loop, 2);
  assert.deepEqual(metadata.delay, [100, 200, 300]);
  assert.ok(result.media.length <= MAX_IMAGE_BYTES);
  assert.equal(result.frames.length, 3);
  for (let index = 0; index < result.frames.length; index++) {
    const frameMetadata = await sharp(result.frames[index]).metadata();
    assert.equal(frameMetadata.format, "webp");
    assert.equal(frameMetadata.pages ?? 1, 1);
    assert.equal(frameMetadata.width, 768);
    assert.equal(frameMetadata.height, 384);
    const stats = await sharp(result.frames[index]).stats();
    assert.ok(stats.channels[index].mean > 240, "sampled frames retain their original RGB order");
    assert.ok(stats.channels[(index + 1) % 3].mean < 15);
  }
});

test("accepts animated WebP for memes while keeping avatar/import normalization static-only", async () => {
  const gif = await makeGif();
  const webp = await sharp(gif, { animated: true }).webp().toBuffer();
  const file = new File([webp], "campus.webp", { type: "image/webp" });
  const result = await prepareMemeUpload(file);
  assert.equal(result.animated, true);
  assert.equal((await sharp(result.media).metadata()).pages, 3);
  await assert.rejects(normalizeMemeImage(file), ImageValidationError);
  await assert.rejects(normalizeMemeImage(new File([gif], "campus.gif", { type: "image/gif" })), ImageValidationError);
});

test("rejects oversized frame counts, long animations, and compressed animation pixel bombs", async () => {
  const manyFrames = await makeGif({ width: 1, height: 1, colors: Array(121).fill("red"), delay: 10 });
  await assert.rejects(prepareMemeUpload(new File([manyFrames], "many.gif", { type: "image/gif" })), /120 frames/);
  const longGif = await makeGif({ delay: [6000, 6000, 6000] });
  await assert.rejects(prepareMemeUpload(new File([longGif], "long.gif", { type: "image/gif" })), /15 seconds/);
  // Reject untrusted headers claiming four 4000x4000 frames before decoding.
  // Each frame is within 20 MP, but their combined pixel count is over budget.
  const largeCanvas = await makeGif({ width: 1, height: 1, colors: ["red", "green", "blue", "white"], delay: 100 });
  largeCanvas.writeUInt16LE(4000, 6);
  largeCanvas.writeUInt16LE(4000, 8);
  const descriptor = largeCanvas.indexOf(0x2c);
  largeCanvas.writeUInt16LE(4000, descriptor + 5);
  largeCanvas.writeUInt16LE(4000, descriptor + 7);
  await assert.rejects(prepareMemeUpload(new File([largeCanvas], "large.gif", { type: "image/gif" })), /dimensions or number of frames/);
});

test("GIF support still rejects spoofed MIME types, broken files, and oversized input", async () => {
  const gif = await makeGif();
  const inputs = [
    new File([gif], "fake.png", { type: "image/png" }),
    new File([gif.subarray(0, 40)], "broken.gif", { type: "image/gif" }),
    new File([Buffer.alloc(MAX_IMAGE_BYTES + 1)], "huge.gif", { type: "image/gif" }),
    new File([], "empty.gif", { type: "image/gif" }),
  ];
  for (const file of inputs) await assert.rejects(prepareMemeUpload(file), ImageValidationError);
});
