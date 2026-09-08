import { downloadDriveFile } from "./drive";
import { isCloudinaryUrl } from "./keys";

export function hasStoredInvoiceFile(
  invoice: Record<string, unknown> | null | undefined,
): boolean {
  const row = invoice || {};
  if (String(row.googleDriveFileId || "").trim()) return true;
  const storedUrl = String(row.pdfUrl || row.invoicePdfUrl || "").trim();
  return isCloudinaryUrl(storedUrl);
}

export async function downloadInvoicePdfFromRecord(
  invoice: Record<string, unknown> | null | undefined,
): Promise<Buffer | null> {
  const row = invoice || {};
  const driveId = String(row.googleDriveFileId || "").trim();
  if (driveId) {
    try {
      return await downloadDriveFile(driveId);
    } catch {
      return null;
    }
  }

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
