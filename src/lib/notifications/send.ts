import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  customerBody,
  techBody,
  techEventFrom,
} from "@/lib/notifications/copy";
import {
  collectTokensFromDoc,
  deliverToTokens,
  pruneInvalidTokens,
} from "@/lib/notifications/push";

export const ALLOWED_EVENTS = new Set([
  "created",
  "assigned",
  "partner_assigned",
  "accepted",
  "rejected",
  "arriving",
  "started",
  "otp_ready",
  "completed",
  "cancelled",
  "rescheduled",
  "add_on_approval_needed",
  "extras_added",
  "add_on_approved",
  "add_on_rejected",
  "payment_request",
  "payment_received",
  "invoice_generated",
  "booking_assigned",
  "booking_cancelled",
  "kyc_submitted",
  "kyc_approved",
  "kyc_rejected",
  "partner_approved",
  "partner_rejected",
  "profile_updated",
  "system",
]);

const REPEATABLE_EVENTS = new Set(["payment_request", "system"]);
const REPEATABLE_MS = 30 * 60 * 1000;

export type NotifyInput = {
  eventType: string;
  bookingId?: string;
  customerId?: string;
  technicianId?: string;
  serviceName?: string;
  bookingCode?: string;
  title?: string;
  body?: string;
  techTitle?: string;
  techBody?: string;
  audience?: string;
  force?: boolean;
};

function sanitizeText(raw: unknown, max: number): string {
  return String(raw || "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

export function parseNotifyInput(body: Record<string, unknown>): NotifyInput {
  const eventType = sanitizeText(body.eventType, 64).toLowerCase();
  if (!eventType || !ALLOWED_EVENTS.has(eventType)) {
    throw Object.assign(new Error("Invalid eventType"), { status: 400 });
  }
  return {
    eventType,
    bookingId: sanitizeText(body.bookingId, 128),
    customerId: sanitizeText(body.customerId, 128),
    technicianId: sanitizeText(body.technicianId, 128),
    serviceName: sanitizeText(body.serviceName, 160),
    bookingCode: sanitizeText(body.bookingCode, 64),
    title: sanitizeText(body.title, 80),
    body: sanitizeText(body.body, 240),
    techTitle: sanitizeText(body.techTitle, 80),
    techBody: sanitizeText(body.techBody, 240),
    audience: sanitizeText(body.audience || "both", 24).toLowerCase(),
    force: body.force === true,
  };
}

function deliveryDocId(input: NotifyInput): string {
  const scope = input.bookingId || `${input.customerId || "x"}_${input.technicianId || "x"}`;
  return `${scope}__${input.eventType}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 180);
}

async function alreadyDelivered(input: NotifyInput): Promise<boolean> {
  if (input.force) return false;
  const db = getAdminDb();
  const ref = db.collection("notificationDeliveries").doc(deliveryDocId(input));
  const snap = await ref.get();
  if (!snap.exists) return false;
  if (!REPEATABLE_EVENTS.has(input.eventType)) return true;
  const at = snap.data()?.sentAt;
  const ms =
    at && typeof at.toMillis === "function"
      ? at.toMillis()
      : at instanceof Date
        ? at.getTime()
        : 0;
  return ms > 0 && Date.now() - ms < REPEATABLE_MS;
}

async function markDelivered(input: NotifyInput, result: Record<string, unknown>) {
  const db = getAdminDb();
  await db.collection("notificationDeliveries").doc(deliveryDocId(input)).set(
    {
      eventType: input.eventType,
      bookingId: input.bookingId || "",
      customerId: input.customerId || "",
      technicianId: input.technicianId || "",
      sentAt: FieldValue.serverTimestamp(),
      result,
    },
    { merge: true },
  );
}

async function writeInbox(
  collectionName: "customers" | "technicians",
  uid: string,
  row: Record<string, unknown>,
) {
  if (!uid) return;
  try {
    await getAdminDb()
      .collection(collectionName)
      .doc(uid)
      .collection("notifications")
      .add({
        ...row,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
  } catch {
    /* inbox is best-effort; push still goes out */
  }
}

export async function sendBookingNotification(input: NotifyInput) {
  const eventType = String(input.eventType || "").trim().toLowerCase();
  if (!ALLOWED_EVENTS.has(eventType)) {
    throw Object.assign(new Error("Invalid eventType"), { status: 400 });
  }
  input = { ...input, eventType };
  const db = getAdminDb();
  let customerId = input.customerId || "";
  let technicianId = input.technicianId || "";
  let serviceName = input.serviceName || "";
  let bookingCode = input.bookingCode || "";
  const bookingId = input.bookingId || "";
  let booking: Record<string, unknown> | null = null;

  if (bookingId) {
    const snap = await db.collection("bookings").doc(bookingId).get();
    if (snap.exists) {
      booking = (snap.data() || {}) as Record<string, unknown>;
      customerId = String(booking.customerId || "");
      technicianId = String(booking.technicianId || "");
      serviceName = serviceName || String(booking.serviceName || "");
      bookingCode = bookingCode || String(booking.bookingCode || "");
    }
  }

  input = { ...input, customerId, technicianId };

  if (await alreadyDelivered(input)) {
    return {
      ok: true,
      skipped: true,
      reason: "duplicate",
      bookingId,
      customerId,
      technicianId,
    };
  }

  const audience = input.audience || "both";
  const notifyCustomer =
    audience === "customer" || audience === "both" || audience === "all";
  const notifyTech =
    audience === "technician" || audience === "both" || audience === "all";

  const results: Record<string, unknown> = { customer: null, technician: null };

  if (notifyCustomer && customerId) {
    const cSnap = await db.collection("customers").doc(customerId).get();
    const tokens = collectTokensFromDoc(
      cSnap.exists ? (cSnap.data() as Record<string, unknown>) : {},
    );
    const title = input.title || "Booking Update";
    const body = input.body || customerBody(input.eventType, serviceName);
    const delivered = await deliverToTokens(tokens, {
      title,
      body,
      data: {
        type: input.eventType,
        bookingId,
        eventType: input.eventType,
      },
    });
    if (delivered.invalid.length) {
      await pruneInvalidTokens(db, "customers", customerId, delivered.invalid);
    }
    await writeInbox("customers", customerId, {
      title,
      body,
      eventType: input.eventType,
      bookingId,
    });
    results.customer = { ...delivered, tokens: tokens.length };
  }

  if (notifyTech && technicianId) {
    const tSnap = await db.collection("technicians").doc(technicianId).get();
    const tokens = collectTokensFromDoc(
      tSnap.exists ? (tSnap.data() as Record<string, unknown>) : {},
    );
    const techEvent = techEventFrom(input.eventType);
    const title = input.techTitle || "Repair Series";
    const body = input.techBody || techBody(techEvent, serviceName, bookingCode);
    const delivered = await deliverToTokens(tokens, {
      title,
      body,
      data: {
        type: techEvent === "booking_assigned" ? "booking_assigned" : techEvent,
        bookingId,
        eventType: techEvent,
        serviceName,
        bookingCode,
      },
    });
    if (delivered.invalid.length) {
      await pruneInvalidTokens(db, "technicians", technicianId, delivered.invalid);
    }
    await writeInbox("technicians", technicianId, {
      title,
      body,
      eventType: techEvent,
      bookingId,
    });
    results.technician = { ...delivered, tokens: tokens.length };
  }

  await markDelivered(input, results);
  return { ok: true, results, bookingId, customerId, technicianId, booking };
}
