import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  assertBookingAccess,
  requireInvoiceCaller,
  type InvoiceAccess,
} from "@/lib/invoice/server/auth";
import { jsonWithCors } from "@/lib/api/cors";

export async function handleGeneratePost(req: NextRequest) {
  console.info("[Invoice API] Authentication status", "checking");
  let access: InvoiceAccess;
  try {
    access = await requireInvoiceCaller(req);
    console.info("[Invoice API] Authentication result", { ok: true, role: access.role });
  } catch (err) {
    console.info("[Invoice API] Authentication result", { ok: false });
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
    console.info("[Invoice API] Authorization result", { ok: true, role: access.role });
  } catch (err) {
    console.info("[Invoice API] Authorization result", { ok: false, role: access.role });
    throw err;
  }

  console.info("[Invoice API] Invoice generation started", { bookingId });
  let generateAndStoreInvoice: typeof import("@/lib/invoice/server").generateAndStoreInvoice;
  let invoiceSecretsFromEnv: typeof import("@/lib/invoice/server").invoiceSecretsFromEnv;
  try {
    ({ generateAndStoreInvoice, invoiceSecretsFromEnv } = await import(
      "@/lib/invoice/server"
    ));
  } catch (err) {
    throw Object.assign(
      new Error(
        `Invoice generator failed to load: ${String((err as Error)?.message || err)}`,
      ),
      { status: 503 },
    );
  }
  const result = await generateAndStoreInvoice(db, {
    bookingId,
    booking,
    force: access.role === "admin" ? Boolean(body.force) : false,
    sendEmail: access.role === "admin" ? body.sendEmail !== false : true,
    secrets: invoiceSecretsFromEnv(),
  });
  console.info("[Invoice API] Invoice generation completed", { bookingId });

  return jsonWithCors(req, { ok: true, success: true, ...result });
}
