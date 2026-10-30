import sharp from "sharp";
import type { DetectedFileType } from "./fileSignature.js";

/**
 * Longest side, in pixels.
 */
const THUMBNAIL_MAX_DIMENSION_PX = 320;

/**
 * E137: the most pixels we decode (5000 x 5000). sharp's default (268 MP)
 * let a 1 MB PNG decode to ~300 MB of native memory; the 8 MiB upload cap
 * limits bytes, not pixels.
 */
const MAX_INPUT_PIXELS = 25_000_000;

/** E137: one decode at a time, so memory stays bounded under the 512 MB API limit. */
let thumbnailQueue: Promise<unknown> = Promise.resolve();

export interface GeneratedThumbnail {
  buffer: Buffer;
  mimeType: string;
}

/**
 * Generates a review-UI-sized thumbnail from an already-validated upload
 * buffer. Only `jpeg`/`png` documents get one — a `pdf` (commercial
 * registration, bank letter) has no image to thumbnail, and this returns
 * `null` rather than attempting a PDF-to-image conversion. Always
 * re-encodes to JPEG regardless of the source format, so the admin
 * console's `<img>` tag never needs to branch on thumbnail mime type the
 * way the original-file endpoint does.
 */
export async function generateKycThumbnail(
  buffer: Buffer,
  detectedType: DetectedFileType,
): Promise<GeneratedThumbnail | null> {
  if (detectedType !== "jpeg" && detectedType !== "png") {
    return null;
  }
  // YA: the 8 MiB upload cap protects us here
  // FH: sharp's default pixel limit is ~268MP, a tiny png can decode huge. copilot suggests limitInputPixels
  // E137: FH was right (YA's note is false): limit pixels and decode one at a time.
  const run = thumbnailQueue.then(async () => {
    try {
      return await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
        .resize(THUMBNAIL_MAX_DIMENSION_PX, THUMBNAIL_MAX_DIMENSION_PX, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 70 })
        .toBuffer();
    } catch (err) {
      // Too many pixels: store the document without a thumbnail (reviewers
      // open the original; kyc.ts handles a missing thumbnail). Refusing the
      // upload would block real 48 MP phone photos (fix-reviewer).
      if (err instanceof Error && /pixel limit/i.test(err.message)) return null;
      throw err;
    }
  });
  thumbnailQueue = run.catch(() => undefined);
  const resized = await run;
  if (resized === null) return null;
  return { buffer: resized, mimeType: "image/jpeg" };
}
