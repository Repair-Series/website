import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import type { SlotDescriptor } from "@/lib/booking/technician-slots";

export async function verifyBusySlotsFree(
  db: Firestore,
  technicianId: string,
  descriptors: SlotDescriptor[],
  ignoreBookingId: string | null = null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  for (const d of descriptors) {
    const ref = doc(db, "technicians", technicianId, "busySlots", d.slotDocId);
    const snap = await getDoc(ref);
    if (!snap.exists()) continue;
    const data = snap.data();
    if (String(data?.status || "").toLowerCase() !== "busy") continue;
    const bid = String(data.bookingId || "");
    if (ignoreBookingId && bid && bid === ignoreBookingId) continue;
    return { ok: false, message: `Slot ${d.slotLabel} is already busy.` };
  }
  return { ok: true };
}

export async function reserveBusySlotsForBooking(
  db: Firestore,
  technicianId: string,
  bookingId: string,
  descriptors: SlotDescriptor[],
  reason = "booking",
): Promise<void> {
  const bid = String(bookingId);
  await runTransaction(db, async (tx) => {
    for (const d of descriptors) {
      const ref = doc(db, "technicians", technicianId, "busySlots", d.slotDocId);
      const snap = await tx.get(ref);
      if (snap.exists()) {
        const data = snap.data();
        if (String(data?.status || "").toLowerCase() === "busy") {
          const existing = String(data.bookingId || "");
          if (existing === bid) continue;
          throw new Error(`Slot ${d.slotLabel} is not available for this technician.`);
        }
      }
    }
    for (const d of descriptors) {
      const ref = doc(db, "technicians", technicianId, "busySlots", d.slotDocId);
      tx.set(ref, {
        date: d.dateKey,
        slot: d.slotLabel,
        slotIndex: d.slotIndex,
        status: "busy",
        reason,
        bookingId: bid,
        createdAt: serverTimestamp(),
      });
    }
  });
}
