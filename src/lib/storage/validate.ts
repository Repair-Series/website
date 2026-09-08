export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
export const MAX_OPTIMIZED_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_PDF_BYTES = 8 * 1024 * 1024;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function sniffImageType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function validateImageBuffer(
  buffer: Buffer,
  claimedType?: string,
): { contentType: string } {
  if (!buffer?.length) {
    throw Object.assign(new Error("Empty file"), { status: 400 });
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw Object.assign(new Error("Image must be 12 MB or smaller"), {
      status: 400,
    });
  }
  const sniffed = sniffImageType(buffer);
  if (!sniffed) {
    throw Object.assign(
      new Error("Use a JPEG, PNG, or WebP image"),
      { status: 400 },
    );
  }
  const claimed = String(claimedType || "").toLowerCase();
  if (
    claimed &&
    claimed !== "application/octet-stream" &&
    !IMAGE_TYPES.has(claimed) &&
    claimed !== "image/jpg"
  ) {
    throw Object.assign(new Error("Unsupported image type"), { status: 400 });
  }
  return { contentType: sniffed };
}

export function validatePdfBuffer(buffer: Buffer): void {
  if (!buffer?.length) {
    throw Object.assign(new Error("Empty PDF"), { status: 400 });
  }
  if (buffer.length > MAX_PDF_BYTES) {
    throw Object.assign(new Error("PDF is too large to store"), { status: 400 });
  }
  if (buffer.toString("ascii", 0, 5) !== "%PDF-") {
    throw Object.assign(new Error("Invalid PDF"), { status: 400 });
  }
}
