import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { sendBookingNotification, type NotifyInput } from "@/lib/notifications/send";
import { shouldAbandonOutboxItem } from "@/lib/notifications/outbox-policy";

export { MAX_OUTBOX_ATTEMPTS, shouldAbandonOutboxItem } from "@/lib/notifications/outbox-policy";

function outboxPayload(row: Record<string, unknown>): NotifyInput {
  return {
    eventType: String(row.eventType || "").trim(),
    customerId: String(row.customerId || "").trim(),
    technicianId: String(row.technicianId || "").trim(),
    bookingId: String(row.bookingId || "").trim(),
    serviceName: String(row.serviceName || ""),
    bookingCode: String(row.bookingCode || ""),
    title: String(row.title || ""),
    body: String(row.body || ""),
    techTitle: String(row.techTitle || ""),
    techBody: String(row.techBody || ""),
    audience: String(row.audience || "both"),
    skipOutboxDrain: true,
  };
}

export async function enqueueFailedNotification(
  input: NotifyInput,
  error: string,
): Promise<void> {
  const eventType = String(input.eventType || "").trim();
  const bookingId = String(input.bookingId || "").trim();
  if (!eventType) return;

  const db = getAdminDb();
  const now = FieldValue.serverTimestamp();
  await db.collection("bookingNotificationOutbox").add({
    operationType: "notification",
    eventType,
    bookingId,
    customerId: String(input.customerId || ""),
    technicianId: String(input.technicianId || ""),
    serviceName: String(input.serviceName || ""),
    bookingCode: String(input.bookingCode || ""),
    title: String(input.title || ""),
    body: String(input.body || ""),
    techTitle: String(input.techTitle || ""),
    techBody: String(input.techBody || ""),
    audience: String(input.audience || "both"),
    processed: false,
    status: "pending",
    attemptCount: 0,
    lastError: String(error || "").slice(0, 500),
    lastErrorAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

export async function processNotificationOutbox(limit = 25) {
  const db = getAdminDb();
  const snap = await db
    .collection("bookingNotificationOutbox")
    .where("processed", "==", false)
    .orderBy("createdAt", "asc")
    .limit(Math.min(40, Math.max(1, limit)))
    .get();

  let processed = 0;
  let abandoned = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const docSnap of snap.docs) {
    const row = (docSnap.data() || {}) as Record<string, unknown>;
    const attempts = Number(row.attemptCount || 0);
    const now = new Date();

    if (shouldAbandonOutboxItem(attempts)) {
      await docSnap.ref.update({
        processed: true,
        status: "abandoned",
        lastError: String(row.lastError || "Max retry attempts reached"),
        processedAt: now,
        processedBy: "event-outbox",
        updatedAt: now,
      });
      abandoned += 1;
      continue;
    }

    try {
      await sendBookingNotification(outboxPayload(row));
      await docSnap.ref.update({
        processed: true,
        status: "sent",
        attemptCount: attempts + 1,
        processedAt: now,
        processedBy: "event-outbox",
        lastError: null,
        updatedAt: now,
      });
      processed += 1;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push({ id: docSnap.id, error: message });
      try {
        await docSnap.ref.update({
          attemptCount: attempts + 1,
          status: "failed",
          lastError: message.slice(0, 500),
          lastErrorAt: now,
          updatedAt: now,
        });
      } catch {
        /* ignore */
      }
    }
  }

  return { ok: true, scanned: snap.size, processed, abandoned, errors };
}
