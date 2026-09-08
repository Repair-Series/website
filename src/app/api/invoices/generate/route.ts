import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  assertBookingAccess,
  requireInvoiceCaller,
} from "@/lib/invoice/server/auth";
import {
  generateAndStoreInvoice,
  invoiceSecretsFromEnv,
} from "@/lib/invoice/server";
import { invoiceOptions, jsonWithCors } from "@/lib/invoice/server/cors";

export const runtime = "nodejs";
export const maxDuration = 60;

export function OPTIONS(req: NextRequest) {
  return invoiceOptions(req);
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireInvoiceCaller(req);
    const body = (await req.json().catch(() => ({}))) as {
      bookingId?: string;
      force?: boolean;
      sendEmail?: boolean;
    };

    const bookingId = String(body.bookingId || "").trim();
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

    const force = access.role === "admin" ? Boolean(body.force) : false;
    const sendEmail =
      access.role === "admin" ? body.sendEmail !== false : true;

    const result = await generateAndStoreInvoice(db, {
      bookingId,
      booking,
      force,
      sendEmail,
      secrets: invoiceSecretsFromEnv(),
    });

    return jsonWithCors(req, { ok: true, ...result });
  } catch (err) {
    const status = Number((err as { status?: number })?.status) || 500;
    const message = String(
      (err as Error)?.message || "Failed to generate invoice",
    );
    console.error("api/invoices/generate", message);
    return jsonWithCors(req, { error: message }, { status });
  }
}
