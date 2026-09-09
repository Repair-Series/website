import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  assertBookingAccess,
  requireInvoiceCaller,
  type InvoiceAccess,
} from "@/lib/invoice/server/auth";
import {
  generateAndStoreInvoice,
  invoiceSecretsFromEnv,
} from "@/lib/invoice/server";
import { jsonWithCors } from "@/lib/api/cors";

export async function handleGeneratePost(req: NextRequest) {
  console.info("[Invoice API] Authentication status", "checking");
  let access: InvoiceAccess;
  try {
    access = await requireInvoiceCaller(req);
    console.info("[Invoice API] Authentication status", { ok: true, role: access.role });
  } catch (err) {
    console.info("[Invoice API] Authentication status", { ok: false });
    throw err;
  }

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
  try {
    await assertBookingAccess(access, booking);
    console.info("[Invoice API] Authorization status", { ok: true, role: access.role });
  } catch (err) {
    console.info("[Invoice API] Authorization status", { ok: false, role: access.role });
    throw err;
  }

  const force = access.role === "admin" ? Boolean(body.force) : false;
  const sendEmail = access.role === "admin" ? body.sendEmail !== false : true;

  const result = await generateAndStoreInvoice(db, {
    bookingId,
    booking,
    force,
    sendEmail,
    secrets: invoiceSecretsFromEnv(),
  });

  return jsonWithCors(req, { ok: true, ...result });
}
