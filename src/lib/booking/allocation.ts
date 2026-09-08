import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import { buildSlotDocId, slotLabelFromIndex } from "@/lib/booking/technician-slots";
import {
  filterWithinRadiusKm,
  fetchTechniciansMatchingCategory,
  isSlotPastForDate,
  isPastDateKey,
  isSlotStillAvailable as checkSlotStillAvailable,
  type BusySlotEntry,
} from "@/lib/booking/slot-allocation";
import {
  getServiceCategoryId,
  loadGeneralSettings,
  loadTechnicians,
} from "@/lib/booking/slot-availability";
import type { ServiceDoc } from "@/lib/booking/types";

const BOOKING_STATUS = {
  NEW: "New",
  ASSIGNED: "Assigned",
  CANCELLED: "Cancelled",
} as const;

function isSlotBusyEntry(row: Record<string, unknown> | null | undefined): boolean {
  if (!row) return false;
  return String(row.status ?? "").toLowerCase() === "busy";
}

function technicianPhoneFromData(d: Record<string, unknown>): string {
  const candidates = [d.phone, d.mobile, d.contactNumber, d.phoneNumber];
  const hit = candidates.find((x) => x != null && String(x).trim() !== "");
  return hit != null ? String(hit).trim() : "";
}

async function fetchBusyByTechForDate(
  db: Firestore,
  technicianIds: string[],
  dateStr: string,
): Promise<Record<string, BusySlotEntry[]>> {
  const out: Record<string, BusySlotEntry[]> = {};
  await Promise.all(
    technicianIds.map(async (tid) => {
      const snap = await getDocs(
        collection(db, "technicians", tid, "busySlots"),
      );
      const rows: BusySlotEntry[] = [];
      snap.forEach((d) => {
        const data = d.data() as BusySlotEntry;
        const date = String(data.date ?? d.id.split("_")[0] ?? "");
        if (date !== dateStr) return;
        rows.push({ ...data, id: d.id });
      });
      out[tid] = rows;
    }),
  );
  return out;
}

/** Mirrors User App `isSlotStillAvailable`. */
export async function isSlotStillAvailable(
  db: Firestore,
  params: {
    service: ServiceDoc;
    userLat: number;
    userLng: number;
    dateStr: string;
    slotIndex: number;
    platformRadiusKm?: number;
  },
): Promise<boolean> {
  const dateKey = String(params.dateStr ?? "").trim();
  const idx = Number(params.slotIndex);
  if (isPastDateKey(dateKey) || isSlotPastForDate(dateKey, idx)) return false;

  const settings = await loadGeneralSettings(db);
  const radiusKm =
    params.platformRadiusKm ??
    (Number(settings.defaultTechnicianServiceRadiusKm) > 0
      ? Number(settings.defaultTechnicianServiceRadiusKm)
      : 25);
  const allTechnicians = await loadTechnicians(db);
  const categoryId = getServiceCategoryId(params.service);
  const eligible = filterWithinRadiusKm(
    fetchTechniciansMatchingCategory(allTechnicians, categoryId),
    params.userLat,
    params.userLng,
    radiusKm,
  );
  if (!eligible.length) return false;

  const busyByTech = await fetchBusyByTechForDate(
    db,
    eligible.map((t) => t.id),
    dateKey,
  );

  return checkSlotStillAvailable({
    categoryId,
    userLat: params.userLat,
    userLng: params.userLng,
    dateStr: dateKey,
    slotIndex: idx,
    radiusKm,
    allTechnicians,
    busyByTech,
  });
}

/** Mirrors User App `assignNearestTechnicianAndLockBusySlot`. */
export async function assignNearestTechnicianAndLockBusySlot(
  db: Firestore,
  params: {
    bookingId: string;
    categoryId: string;
    service: ServiceDoc;
    userLat: number;
    userLng: number;
    dateStr: string;
    slotLabel: string;
    slotIndex: number;
  },
): Promise<void> {
  const dateKey = String(params.dateStr ?? "").trim();
  const idx = Number(params.slotIndex);
  if (isPastDateKey(dateKey) || isSlotPastForDate(dateKey, idx)) {
    const err = new Error("This time slot has already passed.");
    (err as Error & { code?: string }).code = "PAST_SLOT";
    throw err;
  }

  const settings = await loadGeneralSettings(db);
  const radiusKm =
    Number(settings.defaultTechnicianServiceRadiusKm) > 0
      ? Number(settings.defaultTechnicianServiceRadiusKm)
      : 25;
  const technicians = await loadTechnicians(db);
  const eligible = filterWithinRadiusKm(
    fetchTechniciansMatchingCategory(technicians, params.categoryId),
    params.userLat,
    params.userLng,
    radiusKm,
  );

  if (!eligible.length) {
    const err = new Error("NO_TECH_IN_RADIUS");
    (err as Error & { code?: string }).code = "NO_TECH_IN_RADIUS";
    throw err;
  }

  const docId = buildSlotDocId(dateKey, idx);
  const bookingRef = doc(db, "bookings", params.bookingId);
  const label = params.slotLabel?.trim() || slotLabelFromIndex(idx);

  let locked = false;
  await runTransaction(db, async (transaction) => {
    for (const tech of eligible) {
      const busyRef = doc(db, "technicians", tech.id, "busySlots", docId);
      const busySnap = await transaction.get(busyRef);
      const existing = busySnap.exists() ? busySnap.data() : null;
      if (busySnap.exists() && isSlotBusyEntry(existing as Record<string, unknown>)) {
        continue;
      }

      transaction.set(busyRef, {
        date: dateKey,
        slot: label,
        slotIndex: idx,
        status: "busy",
        reason: "booking",
        bookingId: params.bookingId,
        createdAt: serverTimestamp(),
      });

      const phone = technicianPhoneFromData(tech as unknown as Record<string, unknown>);
      transaction.update(bookingRef, {
        status: BOOKING_STATUS.ASSIGNED,
        technicianId: tech.id,
        technicianName: String(tech.name ?? "").trim() || "",
        ...(phone ? { technicianPhone: phone } : {}),
        scheduledSlotDate: dateKey,
        scheduledSlotLabel: label,
        scheduledSlotIndex: idx,
        updatedAt: serverTimestamp(),
      });
      locked = true;
      return;
    }
  });

  if (!locked) {
    const err = new Error("ALL_TECHS_BUSY");
    (err as Error & { code?: string }).code = "ALL_TECHS_BUSY";
    throw err;
  }
}

export async function releaseBusySlotForBooking(
  db: Firestore,
  booking: Record<string, unknown>,
): Promise<void> {
  const techId = String(booking?.technicianId ?? "").trim();
  const dateStr = String(booking?.scheduledSlotDate ?? "").trim();
  const slotIndex = Number(booking?.scheduledSlotIndex);
  const bookingId = String(booking?.id ?? "").trim();
  if (!techId || !dateStr || !Number.isFinite(slotIndex) || slotIndex < 1 || !bookingId) {
    return;
  }
  const docId = buildSlotDocId(dateStr, slotIndex);
  const busyRef = doc(db, "technicians", techId, "busySlots", docId);
  const snap = await getDoc(busyRef);
  if (!snap.exists()) return;
  const bid = String(snap.data()?.bookingId ?? "").trim();
  if (bid === bookingId) {
    await deleteDoc(busyRef);
  }
}

export async function cancelBookingByUser(
  db: Firestore,
  bookingId: string,
  customerId: string,
): Promise<void> {
  const ref = doc(db, "bookings", bookingId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Booking not found.");
  const data = snap.data() as Record<string, unknown>;
  if (String(data.customerId ?? "") !== customerId) {
    throw new Error("Not allowed.");
  }
  const status = String(data.status ?? "").trim();
  const cancellable = ["New", "Assigned", "pending"].includes(status);
  if (!cancellable) {
    throw new Error("This booking can no longer be cancelled.");
  }

  await updateDoc(ref, {
    status: BOOKING_STATUS.CANCELLED,
    cancelledBy: "user",
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await releaseBusySlotForBooking(db, { id: snap.id, ...data });
}

/** Assign a specific technician (revisit / follow-up) and lock their busy slot. */
export async function assignExistingTechnicianAndLockBusySlot(
  db: Firestore,
  params: {
    bookingId: string;
    technicianId: string;
    dateStr: string;
    slotLabel: string;
    slotIndex: number;
  },
): Promise<void> {
  const dateKey = String(params.dateStr ?? "").trim();
  const idx = Number(params.slotIndex);
  const techId = String(params.technicianId || "").trim();
  if (!techId) throw new Error("Technician required for revisit assignment.");
  if (isPastDateKey(dateKey) || isSlotPastForDate(dateKey, idx)) {
    const err = new Error("This time slot has already passed.");
    (err as Error & { code?: string }).code = "PAST_SLOT";
    throw err;
  }

  const docId = buildSlotDocId(dateKey, idx);
  const bookingRef = doc(db, "bookings", params.bookingId);
  const techRef = doc(db, "technicians", techId);
  const busyRef = doc(db, "technicians", techId, "busySlots", docId);
  const label = params.slotLabel?.trim() || slotLabelFromIndex(idx);

  await runTransaction(db, async (transaction) => {
    const techSnap = await transaction.get(techRef);
    if (!techSnap.exists()) throw new Error("Technician profile missing.");
    const busySnap = await transaction.get(busyRef);
    const existing = busySnap.exists() ? busySnap.data() : null;
    if (busySnap.exists() && isSlotBusyEntry(existing as Record<string, unknown>)) {
      const err = new Error("ALL_TECHS_BUSY");
      (err as Error & { code?: string }).code = "ALL_TECHS_BUSY";
      throw err;
    }
    transaction.set(busyRef, {
      date: dateKey,
      slot: label,
      slotIndex: idx,
      status: "busy",
      reason: "booking",
      bookingId: params.bookingId,
      createdAt: serverTimestamp(),
    });
    const tech = techSnap.data() || {};
    const phone = technicianPhoneFromData(tech as Record<string, unknown>);
    transaction.update(bookingRef, {
      status: BOOKING_STATUS.ASSIGNED,
      technicianId: techId,
      technicianName: String(tech.name ?? "").trim() || "",
      ...(phone ? { technicianPhone: phone } : {}),
      scheduledSlotDate: dateKey,
      scheduledSlotLabel: label,
      scheduledSlotIndex: idx,
      updatedAt: serverTimestamp(),
    });
  });
}
