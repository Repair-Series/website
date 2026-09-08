import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  assertBookingAccess,
  requireInvoiceCaller,
} from "@/lib/invoice/server/auth";
import { invoiceDocId } from "@/lib/server/finance";
import { invoiceCorsHeaders, invoiceOptions } from "@/lib/invoice/server/cors";
import { isCloudinaryUrl } from "@/lib/storage/keys";
import { downloadInvoicePdfFromRecord } from "@/lib/storage/invoicePdf";

export const runtime = "nodejs";
export const maxDuration = 30;

export function OPTIONS(req: NextRequest) {
  return invoiceOptions(req);
}

function jsonError(req: NextRequest, message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: invoiceCorsHeaders(req) },
  );
}

export async function GET(req: NextRequest) {
  try {
    const access = await requireInvoiceCaller(req);
    const bookingId = String(
      req.nextUrl.searchParams.get("bookingId") || "",
    ).trim();
    if (!bookingId) {
      return jsonError(req, "Missing bookingId", 400);
    }

    const db = getAdminDb();
    const bookingSnap = await db.doc(`bookings/${bookingId}`).get();
    if (!bookingSnap.exists) {
      return jsonError(req, "Booking not found", 404);
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
          ...invoiceCorsHeaders(req),
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
        headers: invoiceCorsHeaders(req),
      });
    }

    return jsonError(req, "Invoice PDF is not ready yet", 404);
  } catch (err) {
    const status = Number((err as { status?: number })?.status) || 500;
    const message = String((err as Error)?.message || "Not allowed");
    return jsonError(req, message, status);
  }
}
