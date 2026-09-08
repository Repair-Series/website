import { FieldValue, type Firestore } from "firebase-admin/firestore";
import {
  bookingEconomicsPatch,
  financeFromBooking,
} from "@/lib/server/finance";

const SETTINGS_GENERAL = "settings/general";
const SETTINGS_INVOICE = "settings/invoice";
const BOOKING_STATUS_COMPLETED = "Completed";

/** Freeze booking economics once when status is Completed. Idempotent. */
export async function freezeBookingEconomics(
  db: Firestore,
  bookingId: string,
): Promise<{ ok: true; skipped?: boolean }> {
  const bookingRef = db.doc(`bookings/${bookingId}`);
  await db.runTransaction(async (txn) => {
    const fresh = await txn.get(bookingRef);
    if (!fresh.exists) {
      throw Object.assign(new Error("Booking not found"), { status: 404 });
    }
    const b = (fresh.data() || {}) as Record<string, unknown>;
    if (String(b.status ?? "").trim() !== BOOKING_STATUS_COMPLETED) {
      return;
    }
    if (b.economicsSnapshotAt != null) return;

    const settingsSnap = await txn.get(db.doc(SETTINGS_GENERAL));
    const invoiceSnap = await txn.get(db.doc(SETTINGS_INVOICE));
    const settingsGeneral = settingsSnap.exists
      ? ((settingsSnap.data() || {}) as Record<string, unknown>)
      : {};
    const settingsInvoice = invoiceSnap.exists
      ? ((invoiceSnap.data() || {}) as Record<string, unknown>)
      : {};

    const snap = financeFromBooking({
      booking: b,
      settingsGeneral,
      settingsInvoice,
    });
    const econ = bookingEconomicsPatch(snap);

    const patch: Record<string, unknown> = {
      ...econ,
      economicsSnapshotAt: FieldValue.serverTimestamp(),
      financeCalculatedAt: snap.calculatedAt,
      updatedAt: FieldValue.serverTimestamp(),
    };
    txn.update(bookingRef, patch);
  });
  return { ok: true };
}
