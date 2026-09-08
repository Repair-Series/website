import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { apiOptions, jsonWithCors, publicErrorMessage } from "@/lib/server/http";
import { assertBookingAccess, requireApiCaller } from "@/lib/server/auth";
import { freezeBookingEconomics } from "@/lib/booking/freeze-economics";

export const runtime = "nodejs";
export const maxDuration = 30;

export function OPTIONS(req: NextRequest) {
  return apiOptions(req);
}

export async function POST(req: NextRequest) {
  try {
    const caller = await requireApiCaller(req);
    const body = (await req.json().catch(() => ({}))) as { bookingId?: string };
    const bookingId = String(body.bookingId || "").trim();
    if (!bookingId) {
      return jsonWithCors(req, { error: "Missing bookingId" }, { status: 400 });
    }

    const db = getAdminDb();
    const snap = await db.doc(`bookings/${bookingId}`).get();
    if (!snap.exists) {
      return jsonWithCors(req, { error: "Booking not found" }, { status: 404 });
    }
    const booking = (snap.data() || {}) as Record<string, unknown>;
    assertBookingAccess(caller, booking);

    if (String(booking.status ?? "").trim() !== "Completed") {
      return jsonWithCors(
        req,
        { error: "Booking is not completed" },
        { status: 400 },
      );
    }

    await freezeBookingEconomics(db, bookingId);
    return jsonWithCors(req, { ok: true, bookingId });
  } catch (err) {
    const status = Number((err as { status?: number })?.status) || 500;
    const message = publicErrorMessage(err, "Could not freeze booking economics");
    if (status >= 500) console.error("api/bookings/freeze-economics", message);
    return jsonWithCors(req, { error: message }, { status });
  }
}
