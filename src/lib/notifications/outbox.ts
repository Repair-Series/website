import { getAdminDb } from "@/lib/firebase/admin";
import { sendBookingNotification } from "@/lib/notifications/send";

export async function processNotificationOutbox(limit = 25) {
  const db = getAdminDb();
  const snap = await db
    .collection("bookingNotificationOutbox")
    .where("processed", "==", false)
    .orderBy("createdAt", "asc")
    .limit(Math.min(40, Math.max(1, limit)))
    .get();

  let processed = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const docSnap of snap.docs) {
    const row = (docSnap.data() || {}) as Record<string, unknown>;
    try {
      await sendBookingNotification({
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
      });
      await docSnap.ref.update({
        processed: true,
        processedAt: new Date(),
        processedBy: "vercel-outbox",
      });
      processed += 1;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push({ id: docSnap.id, error: message });
      try {
        await docSnap.ref.update({
          lastError: message,
          lastErrorAt: new Date(),
        });
      } catch {
        /* ignore */
      }
    }
  }

  return { ok: true, scanned: snap.size, processed, errors };
}
