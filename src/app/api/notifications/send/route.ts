import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { apiOptions, jsonWithCors, publicErrorMessage } from "@/lib/server/http";
import {
  assertBookingAccess,
  requireAdminOrInternal,
  requireApiCaller,
} from "@/lib/server/auth";
import {
  parseNotifyInput,
  sendBookingNotification,
} from "@/lib/notifications/send";

export const runtime = "nodejs";
export const maxDuration = 30;

export function OPTIONS(req: NextRequest) {
  return apiOptions(req);
}

export async function POST(req: NextRequest) {
  try {
    const caller = await requireApiCaller(req);
    const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const input = parseNotifyInput(raw);

    const db = getAdminDb();
    if (input.bookingId) {
      const snap = await db.collection("bookings").doc(input.bookingId).get();
      if (!snap.exists) {
        return jsonWithCors(req, { error: "Booking not found" }, { status: 404 });
      }
      assertBookingAccess(caller, (snap.data() || {}) as Record<string, unknown>);
    } else {
      requireAdminOrInternal(caller);
      if (!input.customerId && !input.technicianId) {
        return jsonWithCors(
          req,
          { error: "bookingId or recipient id required" },
          { status: 400 },
        );
      }
    }

    const result = await sendBookingNotification(input);
    return jsonWithCors(req, { ok: true, results: result.results });
  } catch (err) {
    const status = Number((err as { status?: number })?.status) || 500;
    const message = publicErrorMessage(err, "Notification failed");
    if (status >= 500) console.error("api/notifications/send", message);
    return jsonWithCors(req, { error: message }, { status });
  }
}
