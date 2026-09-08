const MAX_EDGE = 1920;
const WEBP_QUALITY = 82;
const JPEG_QUALITY = 84;
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

/**
 * Server-side image optimize before Cloudinary upload.
 * JPEG/PNG/WebP → resize oversized edges, WebP when it actually shrinks.
 * PDFs and unknown buffers are returned unchanged.
 */
export async function optimizeImageBuffer(
  buffer: Buffer,
  contentType: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  const type = String(contentType || "").toLowerCase();
  if (type === "application/pdf") {
    return { buffer, contentType: type };
  }
  if (!type.startsWith("image/")) {
    return { buffer, contentType };
  }

  try {
    const sharp = (await import("sharp")).default;
    const image = sharp(buffer, { failOn: "none" }).rotate();
    const meta = await image.metadata();
    const width = Number(meta.width) || 0;
    const height = Number(meta.height) || 0;
    let pipeline = image;
    if (Math.max(width, height) > MAX_EDGE) {
      pipeline = pipeline.resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    const webp = await pipeline.webp({ quality: WEBP_QUALITY, effort: 4 }).toBuffer();
    if (webp.length > 0 && webp.length <= buffer.length && webp.length <= MAX_OUTPUT_BYTES) {
      return { buffer: Buffer.from(webp), contentType: "image/webp" };
    }

    if (type === "image/jpeg" || type === "image/jpg") {
      const jpeg = await sharp(buffer, { failOn: "none" })
        .rotate()
        .resize({
          width: MAX_EDGE,
          height: MAX_EDGE,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toBuffer();
      if (jpeg.length > 0 && jpeg.length < buffer.length) {
        return { buffer: Buffer.from(jpeg), contentType: "image/jpeg" };
      }
    }

    return { buffer, contentType: type };
  } catch {
    return { buffer, contentType: type || "image/jpeg" };
  }
}
