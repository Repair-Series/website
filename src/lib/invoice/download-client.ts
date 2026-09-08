"use client";

export async function downloadOwnInvoicePdf(options: {
  bookingId: string;
  token: string;
  fileName?: string;
}) {
  const bookingId = String(options.bookingId || "").trim();
  if (!bookingId) throw new Error("Missing bookingId");
  if (!options.token) throw new Error("Sign in required");

  const response = await fetch(
    `/api/invoices/file?bookingId=${encodeURIComponent(bookingId)}`,
    { headers: { Authorization: `Bearer ${options.token}` } },
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || "Could not download invoice");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = options.fileName || `invoice-${bookingId}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
