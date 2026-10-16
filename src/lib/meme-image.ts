import sharp from "sharp";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FRAME_PIXELS = 20_000_000;
const MAX_ANIMATION_PIXELS = 60_000_000;
const MAX_ANIMATION_FRAMES = 120;
const MAX_ANIMATION_DURATION_MS = 15_000;

export type MemeUpload = { media: Buffer; frames: Buffer[]; animated: boolean };

export class ImageValidationError extends Error {}

/** Keep the static-only contract used by avatars and the starter import script. */
export async function normalizeMemeImage(file: File): Promise<Buffer> {
  return normalizeUpload(file, false);
}

/** Publish the animation, but send Gemini only independently encoded still images. */
export async function prepareMemeUpload(file: File): Promise<MemeUpload> {
  const media = await normalizeUpload(file, true);
  try {
    const metadata = await sharp(media).metadata();
    const pages = metadata.pages ?? 1;
    if (pages === 1) return { media, frames: [media], animated: false };
    const frames: Buffer[] = [];
    const pageNumbers = [...new Set([0, Math.floor((pages - 1) / 2), pages - 1])];
    for (const page of pageNumbers) {
      frames.push(await sharp(media, { page, pages: 1, limitInputPixels: MAX_FRAME_PIXELS, failOn: "warning" })
        .resize({ width: 768, height: 768, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 }).timeout({ seconds: 4 }).toBuffer());
    }
    return { media, frames, animated: true };
  } catch {
    throw new ImageValidationError("This animation could not be read. Try a shorter or smaller GIF.");
  }
}

/** Decode untrusted uploads, bound their dimensions and strip embedded metadata. */
async function normalizeUpload(file: File, allowAnimation: boolean): Promise<Buffer> {
  if (!file.size || file.size > MAX_IMAGE_BYTES) {
    throw new ImageValidationError(allowAnimation ? "Choose an image or GIF no larger than 2 MB." : "Choose an image no larger than 2 MB.");
  }
  if (!allowedMimeTypes.has(file.type) && !(allowAnimation && file.type === "image/gif")) {
    throw new ImageValidationError(allowAnimation ? "Choose a JPEG, PNG, WebP, or GIF image." : "Choose a JPEG, PNG, or WebP image.");
  }
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const decoder = sharp(bytes, { limitInputPixels: MAX_FRAME_PIXELS, failOn: "warning" });
    const metadata = await decoder.metadata();
    const expectedFormat = file.type === "image/jpeg" ? "jpeg" : file.type.slice(6);
    const pages = metadata.pages ?? 1;
    const animated = pages > 1;
    if (metadata.format !== expectedFormat || !metadata.width || !metadata.height
      || (animated && (!allowAnimation || !["gif", "webp"].includes(metadata.format)))) {
      throw new Error("Invalid image");
    }
    if (animated) {
      if (pages > MAX_ANIMATION_FRAMES) {
        throw new ImageValidationError("Choose an animation with no more than 120 frames.");
      }
      if (metadata.width * (metadata.pageHeight ?? metadata.height) * pages > MAX_ANIMATION_PIXELS) {
        throw new ImageValidationError("This animation is too large to process. Reduce its dimensions or number of frames.");
      }
      const duration = (metadata.delay ?? Array<number>(pages).fill(100))
        .reduce((sum, delay) => sum + Math.max(delay, 10), 0);
      if (duration > MAX_ANIMATION_DURATION_MS) {
        throw new ImageValidationError("Choose an animation that is 15 seconds or shorter.");
      }
    }
    const pipeline = animated
      ? sharp(bytes, { animated: true, limitInputPixels: MAX_ANIMATION_PIXELS, failOn: "warning" })
      : decoder.rotate();
    const bound = animated ? 800 : 1600;
    const normalized = await pipeline
      .resize({ width: bound, height: bound, fit: "inside", withoutEnlargement: true })
      .webp({ quality: animated ? 80 : 85, effort: 3 })
      .timeout({ seconds: 8 }).toBuffer();
    if (normalized.length > MAX_IMAGE_BYTES) {
      throw new ImageValidationError("The processed image is larger than 2 MB. Try a smaller image or shorter GIF.");
    }
    return normalized;
  } catch (error) {
    if (error instanceof ImageValidationError) throw error;
    throw new ImageValidationError(allowAnimation
      ? "This image could not be read. Try a JPEG, PNG, WebP, or GIF under 20 megapixels per frame."
      : "This image could not be read. Try a non-animated JPEG, PNG, or WebP under 20 megapixels.");
  }
}
