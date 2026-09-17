import { isCloudinaryUrl } from "./keys";

export function hasStoredInvoiceFile(
  invoice: Record<string, unknown> | null | undefined,
): boolean {
  const row = invoice || {};
  const storedUrl = String(row.pdfUrl || row.invoicePdfUrl || "").trim();
  return isCloudinaryUrl(storedUrl);
}

export async function downloadInvoicePdfFromRecord(
  invoice: Record<string, unknown> | null | undefined,
): Promise<Buffer | null> {
  const row = invoice || {};
  const storedUrl = String(row.pdfUrl || row.invoicePdfUrl || "").trim();
  if (isCloudinaryUrl(storedUrl)) {
    try {
      const res = await fetch(storedUrl);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }
  return null;
}
