import sharp from "sharp";
import { normalizeMemeImage } from "./meme-image";

export async function normalizeAvatar(file: File): Promise<Buffer> {
  const decoded = await normalizeMemeImage(file);
  return sharp(decoded).resize(256, 256, { fit: "cover", position: "centre" }).webp({ quality: 85 }).toBuffer();
}
