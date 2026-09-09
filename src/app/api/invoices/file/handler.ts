import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  assertBookingAccess,
  requireInvoiceCaller,
} from "@/lib/invoice/server/auth";
import { invoiceDocId } from "@/lib/server/finance";
import { apiCorsHeaders, jsonWithCors } from "@/lib/api/cors";
import { isCloudinaryUrl } from "@/lib/storage/keys";
import { downloadInvoicePdfFromRecord } from "@/lib/storage/invoicePdf";

export async function handleInvoiceFileGet(req: NextRequest) {
  const access = await requireInvoiceCaller(req);
  const bookingId = String(
    req.nextUrl.searchParams.get("bookingId") || "",
  ).trim();
  if (!bookingId) {
    return jsonWithCors(req, { error: "Missing bookingId" }, { status: 400 });
  }

  const db = getAdminDb();
  const bookingSnap = await db.doc(`bookings/${bookingId}`).get();
  if (!bookingSnap.exists) {
    return jsonWithCors(req, { error: "Booking not found" }, { status: 404 });
  }
  const booking = (bookingSnap.data() || {}) as Record<string, unknown>;
  await assertBookingAccess(access, booking);

  const invoiceId = String(booking.invoiceId || invoiceDocId(bookingId));
  const invoiceSnap = await db.doc(`invoices/${invoiceId}`).get();
  const invoice = invoiceSnap.exists
    ? ((invoiceSnap.data() || {}) as Record<string, unknown>)
    : {};

  const pdfBuffer = await downloadInvoicePdfFromRecord(invoice);
  if (pdfBuffer) {
    const fileName = String(invoice.fileName || `invoice-${bookingId}.pdf`);
    const bytes = new Uint8Array(pdfBuffer);
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        ...apiCorsHeaders(req),
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const storedUrl = String(
    invoice.pdfUrl || invoice.invoicePdfUrl || booking.invoicePdfUrl || "",
  ).trim();
  if (isCloudinaryUrl(storedUrl)) {
    return NextResponse.redirect(storedUrl, {
      status: 302,
      headers: apiCorsHeaders(req),
    });
  }

  return jsonWithCors(req, { error: "Invoice PDF is not ready yet" }, { status: 404 });
}
