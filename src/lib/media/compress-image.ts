const MAX_EDGE = 1920;
const QUALITY = 0.82;

/** Light browser-side resize so uploads stay under the Vercel body limit. */
export async function compressImageFile(file: File | Blob): Promise<File> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return file instanceof File ? file : new File([file], "image.jpg", { type: file.type });
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file instanceof File ? file : new File([file], "image.jpg", { type: file.type });
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", QUALITY);
  });
  if (!blob) {
    return file instanceof File ? file : new File([file], "image.jpg", { type: file.type });
  }
  const name =
    file instanceof File
      ? file.name.replace(/\.[a-z0-9]+$/i, ".webp")
      : "image.webp";
  return new File([blob], name, { type: "image/webp" });
}
