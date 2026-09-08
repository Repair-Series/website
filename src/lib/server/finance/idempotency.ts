export function invoiceDocId(bookingId: string): string {
  return `inv_${String(bookingId || "").trim()}`;
}

export function shouldSendInvoiceEmail(invoice: Record<string, unknown> | null | undefined): boolean {
  const status = String(invoice?.emailStatus ?? invoice?.invoiceEmailStatus ?? "")
    .trim()
    .toLowerCase();
  return status !== "sent";
}

export function resolveInvoiceNumber(opts: {
  existingNumber?: unknown;
  prefix?: unknown;
  bookingId: string;
  now?: Date;
}): string {
  const existing = String(opts.existingNumber || "").trim();
  if (existing) return existing;
  const prefix = String(opts.prefix || "INV")
    .trim()
    .toUpperCase()
    .slice(0, 8) || "INV";
  const now = opts.now || new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const shortId = String(opts.bookingId || "").slice(-8).toUpperCase() || "XXXXXXXX";
  return `${prefix}-${y}${m}${d}-${shortId}`;
}
