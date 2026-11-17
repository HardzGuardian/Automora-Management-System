import "server-only";
import sharp from "sharp";
import { DomainError } from "@/lib/errors";

/** Profile photos are stored as a small square JPEG, whatever the user uploaded. */
export const AVATAR_SIZE = 256;
const ALLOWED_FORMATS = ["jpeg", "png", "webp"];
// ~40 megapixels: bigger than any phone photo, small enough to stop decompression bombs.
const MAX_INPUT_PIXELS = 40_000_000;

const NOT_AN_IMAGE = "That file is not a valid PNG, JPEG or WebP image";

/**
 * Decodes an untrusted image and re-encodes it: square crop, EXIF orientation applied, every
 * piece of metadata (GPS location, camera, embedded text) removed, transparency flattened to white.
 * The stored bytes are therefore ours, never the uploader's.
 */
export async function toAvatarJpeg(bytes: Buffer): Promise<Buffer> {
  try {
    const meta = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
    if (!meta.format || !ALLOWED_FORMATS.includes(meta.format)) throw new Error("format");
    return await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS })
      .autoOrient()
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new DomainError("VALIDATION", NOT_AN_IMAGE);
  }
}
