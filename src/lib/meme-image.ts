import sharp from "sharp";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export class ImageValidationError extends Error {}

/** Decode untrusted uploads, bound their dimensions and strip embedded metadata. */
export async function normalizeMemeImage(file: File): Promise<Buffer> {
  if (!file.size || file.size > MAX_IMAGE_BYTES) {
    throw new ImageValidationError("Choose an image smaller than 2 MB.");
  }
  if (!allowedMimeTypes.has(file.type)) {
    throw new ImageValidationError("Choose a JPEG, PNG, or WebP image.");
  }
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const decoder = sharp(bytes, { limitInputPixels: 20_000_000, failOn: "warning" });
    const metadata = await decoder.metadata();
    const expectedFormat = file.type === "image/jpeg" ? "jpeg" : file.type.slice(6);
    if (metadata.format !== expectedFormat || (metadata.pages ?? 1) !== 1) {
      throw new Error("Invalid or animated image");
    }
    const normalized = await decoder.rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 }).toBuffer();
    if (normalized.length > MAX_IMAGE_BYTES) throw new Error("Image too large");
    return normalized;
  } catch {
    throw new ImageValidationError("This image could not be read. Try a non-animated JPEG, PNG, or WebP under 20 megapixels.");
  }
}
