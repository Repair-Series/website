import { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { apiOptions, jsonWithCors, publicErrorMessage } from "@/lib/server/http";
import { requireApiCaller } from "@/lib/server/auth";
import { freezeBookingEconomics } from "@/lib/booking/freeze-economics";
import { sendBookingNotification } from "@/lib/notifications/send";
import {
  generateAndStoreInvoice,
  invoiceSecretsFromEnv,
} from "@/lib/invoice/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const BOOKING_STATUS_COMPLETED = "Completed";

export function OPTIONS(req: NextRequest) {
  return apiOptions(req);
}

export async function POST(req: NextRequest) {
  try {
    const caller = await requireApiCaller(req);
    if (caller.role !== "customer" && caller.role !== "admin" && caller.role !== "internal") {
      throw Object.assign(new Error("Not allowed"), { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { bookingId?: string };
    const bookingId = String(body.bookingId || "").trim();
    if (!bookingId) {
      return jsonWithCors(req, { error: "Missing bookingId" }, { status: 400 });
    }

    const db = getAdminDb();
    const bookingRef = db.doc(`bookings/${bookingId}`);
    const uid = caller.uid;

    await db.runTransaction(async (txn) => {
      const snap = await txn.get(bookingRef);
      if (!snap.exists) {
        throw Object.assign(new Error("Booking not found"), { status: 404 });
      }
      const data = (snap.data() || {}) as Record<string, unknown>;
      if (caller.role === "customer" && String(data.customerId ?? "") !== String(uid)) {
        throw Object.assign(new Error("Not allowed"), { status: 403 });
      }

      const pr = data.paymentRequest as Record<string, unknown> | undefined;
      if (!pr || String(pr.status ?? "").toLowerCase() !== "pending") {
        throw Object.assign(new Error("No pending payment request"), { status: 400 });
      }
      if (String(pr.method ?? "").toLowerCase() !== "rs_app") {
        throw Object.assign(new Error("Unsupported payment method"), { status: 400 });
      }
      const photo = data.completionPhoto as { url?: string } | undefined;
      if (!String(photo?.url ?? "").trim()) {
        throw Object.assign(
          new Error("Technician has not submitted completion photo yet"),
          { status: 400 },
        );
      }
      if (String(data.paymentStatus ?? "").toLowerCase() === "paid") {
        throw Object.assign(new Error("Payment already confirmed"), { status: 400 });
      }

      txn.update(bookingRef, {
        paymentStatus: "paid",
        paymentMethod: "rs_app",
        paidAt: FieldValue.serverTimestamp(),
        paymentConfirmedAt: FieldValue.serverTimestamp(),
        status: BOOKING_STATUS_COMPLETED,
        completedAt: FieldValue.serverTimestamp(),
        paymentRequest: {
          ...pr,
          status: "paid",
          paidAt: FieldValue.serverTimestamp(),
          confirmedBy: caller.role === "customer" ? uid : caller.role,
          confirmSource: "vercel-confirm-payment",
        },
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await freezeBookingEconomics(db, bookingId).catch((err) => {
      console.error("confirm-payment freeze", (err as Error)?.message);
    });

    const bookingSnap = await bookingRef.get();
    const booking = (bookingSnap.data() || {}) as Record<string, unknown>;

    await generateAndStoreInvoice(db, {
      bookingId,
      booking,
      sendEmail: true,
      secrets: invoiceSecretsFromEnv(),
    }).catch((err) => {
      console.error("confirm-payment invoice", (err as Error)?.message);
    });

    await sendBookingNotification({
      eventType: "completed",
      bookingId,
      customerId: String(booking.customerId || ""),
      technicianId: String(booking.technicianId || ""),
      serviceName: String(booking.serviceName || ""),
      bookingCode: String(booking.bookingCode || ""),
      audience: "both",
    }).catch((err) => {
      console.error("confirm-payment notify", (err as Error)?.message);
    });

    return jsonWithCors(req, { ok: true, bookingId });
  } catch (err) {
    const status = Number((err as { status?: number })?.status) || 500;
    const message = publicErrorMessage(err, "Payment confirmation failed");
    if (status >= 500) console.error("api/bookings/confirm-payment", message);
    return jsonWithCors(req, { error: message }, { status });
  }
}
