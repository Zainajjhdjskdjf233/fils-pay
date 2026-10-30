/**
 * E137 [coverage]: a small PNG that decodes to a huge image (a decompression
 * bomb) must not be decoded at full size: no thumbnail is made for it. Before the
 * fix sharp used its 268 MP default; a 1 MB 16383x16383 PNG peaked near 300 MB.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { generateKycThumbnail } from "./kycThumbnail.js";

test("testE137_hugePixelCountIsRefusedBeforeDecoding", async () => {
  // 6000 x 6000 = 36 MP, flat colour: a tiny file that decodes to ~144 MB.
  const bomb = await sharp({ create: { width: 6000, height: 6000, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  assert.ok(bomb.length < 1_000_000, `test file should be small, got ${bomb.length} bytes`);
  // Refused before decoding: no thumbnail (the document itself is still stored).
  assert.equal(await generateKycThumbnail(bomb, "png"), null);
});

test("testE137_normalPhotoStillGetsAThumbnail", async () => {
  const photo = await sharp({ create: { width: 3000, height: 4000, channels: 3, background: { r: 10, g: 20, b: 30 } } }).jpeg().toBuffer();
  const thumb = await generateKycThumbnail(photo, "jpeg");
  assert.ok(thumb && thumb.mimeType === "image/jpeg");
});
