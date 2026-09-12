import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { jsonWithCors, publicErrorMessage } from "@/lib/server/http";
import {
  assertBookingAccess,
  requireAdminOrInternal,
  requireApiCaller,
} from "@/lib/server/auth";
import {
  parseNotifyInput,
  sendBookingNotification,
  type NotifyInput,
} from "@/lib/notifications/send";

export async function handleNotifyPost(req: NextRequest) {
  let parsed: NotifyInput | null = null;
  try {
    const caller = await requireApiCaller(req);
    const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    parsed = parseNotifyInput(raw);

    const db = getAdminDb();
    if (parsed.bookingId) {
      const snap = await db.collection("bookings").doc(parsed.bookingId).get();
      if (!snap.exists) {
        return jsonWithCors(req, { error: "Booking not found" }, { status: 404 });
      }
      assertBookingAccess(caller, (snap.data() || {}) as Record<string, unknown>);
    } else {
      requireAdminOrInternal(caller);
      if (!parsed.customerId && !parsed.technicianId) {
        return jsonWithCors(
          req,
          { error: "bookingId or recipient id required" },
          { status: 400 },
        );
      }
    }

    const result = await sendBookingNotification(parsed);
    return jsonWithCors(req, { ok: true, results: result.results });
  } catch (err) {
    const status = Number((err as { status?: number })?.status) || 500;
    const message = publicErrorMessage(err, "Notification failed");
    if (status >= 500) {
      console.error("api/notifications/send", message);
      if (parsed) {
        try {
          const { enqueueFailedNotification } = await import(
            "@/lib/notifications/outbox"
          );
          await enqueueFailedNotification(parsed, message);
        } catch {
          /* outbox is best-effort */
        }
      }
    }
    return jsonWithCors(req, { error: message }, { status });
  }
}
