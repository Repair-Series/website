import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { assertBookingAccess, type ApiCaller } from "@/lib/server/auth";
import {
  fetchTechniciansMatchingCategory,
  isPastDateKey,
  isSlotPastForDate,
  rankPartnersByDistance,
} from "@/lib/booking/slot-allocation";
import { buildSlotDocId, slotLabelFromIndex } from "@/lib/booking/technician-slots";
import { getBookingLatLng } from "@/lib/geo";
import type { TechnicianDoc } from "@/lib/booking/types";

export type AssignMode = "nearest" | "specific" | "unassign";

export type AssignPartnerInput = {
  bookingId: string;
  mode: AssignMode;
  caller: ApiCaller;
  technicianId?: string;
  dateStr?: string;
  slotIndex?: number;
  slotLabel?: string;
  reservedSlotIndices?: number[];
  categoryId?: string;
  userLat?: number;
  userLng?: number;
};

export type AssignPartnerResult = {
  success: true;
  bookingId: string;
  technicianId: string | null;
  technicianName: string;
  status: string;
};

function fail(message: string, status: number, code?: string): never {
  throw Object.assign(new Error(message), { status, code });
}

function technicianPhone(data: Record<string, unknown>): string {
  const candidates = [data.phone, data.mobile, data.contactNumber, data.phoneNumber];
  const hit = candidates.find((value) => value != null && String(value).trim() !== "");
  return hit != null ? String(hit).trim() : "";
}

function isBusy(row: Record<string, unknown> | undefined): boolean {
  return String(row?.status ?? "").toLowerCase() === "busy";
}

function isAssignable(tech: Record<string, unknown>): boolean {
  if (tech.suspended === true) return false;
  const kycStatus = String((tech.kyc as { status?: string } | undefined)?.status ?? "").toLowerCase();
  const accountStatus = String(
    tech.verificationStatus ?? tech.accountStatus ?? tech.status ?? "",
  )
    .trim()
    .toLowerCase();
  if (accountStatus === "rejected" || accountStatus === "pending") return false;
  if (kycStatus && kycStatus !== "approved") return false;
  return true;
}

function slotIds(dateKey: string, slotIndex: number, extra?: number[]): number[] {
  const ids = new Set<number>();
  if (Number.isFinite(slotIndex) && slotIndex >= 1) ids.add(slotIndex);
  for (const value of extra || []) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 1) ids.add(n);
  }
  return [...ids];
}

async function releaseSlotsForBooking(
  db: Firestore,
  technicianId: string,
  bookingId: string,
  dateKey: string,
  indices: number[],
) {
  if (!technicianId || !indices.length) return;
  for (const index of indices) {
    const ref = db.doc(`technicians/${technicianId}/busySlots/${buildSlotDocId(dateKey, index)}`);
    const snap = await ref.get();
    if (!snap.exists) continue;
    if (String(snap.data()?.bookingId ?? "") === bookingId) {
      await ref.delete();
    }
  }
}

export async function assignPartner(input: AssignPartnerInput): Promise<AssignPartnerResult> {
  const bookingId = String(input.bookingId || "").trim();
  if (!bookingId) fail("Missing bookingId", 400, "INVALID_REQUEST");

  const db = getAdminDb();
  const bookingRef = db.doc(`bookings/${bookingId}`);
  const bookingSnap = await bookingRef.get();
  if (!bookingSnap.exists) fail("Booking not found", 404, "NOT_FOUND");
  const booking = (bookingSnap.data() || {}) as Record<string, unknown>;
  assertBookingAccess(input.caller, booking);

  const unsafe = ["Started", "InProgress", "In Progress", "Paused", "Completed", "Cancelled", "Canceled"];
  if (unsafe.includes(String(booking.status || ""))) {
    fail(`Cannot change assignment while booking status is ${booking.status}.`, 409, "UNSAFE_STATUS");
  }

  const dateKey =
    String(input.dateStr || booking.scheduledSlotDate || booking.scheduleDateKey || booking.date || "").trim();
  const slotIndex = Number(
    input.slotIndex ?? booking.scheduledSlotIndex ?? booking.scheduleSlotIndex ?? 0,
  );
  const slotLabel =
    String(input.slotLabel || booking.scheduledSlotLabel || "").trim() ||
    (slotIndex ? slotLabelFromIndex(slotIndex) : "");
  const reserved = slotIds(
    dateKey,
    slotIndex,
    input.reservedSlotIndices ||
      (Array.isArray(booking.reservedSlotIndices)
        ? (booking.reservedSlotIndices as number[])
        : undefined),
  );

  if (input.mode === "unassign") {
    if (input.caller.role !== "admin" && input.caller.role !== "internal") {
      fail("Not allowed", 403, "FORBIDDEN");
    }
    const prevTech = String(booking.technicianId || "").trim();
    if (prevTech && dateKey) {
      await releaseSlotsForBooking(db, prevTech, bookingId, dateKey, reserved.length ? reserved : [slotIndex]);
    }
    await bookingRef.update({
      technicianId: null,
      technicianName: "",
      technicianPhone: FieldValue.delete(),
      status: "New",
      reservedSlotIndices: [],
      updatedAt: FieldValue.serverTimestamp(),
    });
    return {
      success: true,
      bookingId,
      technicianId: null,
      technicianName: "",
      status: "New",
    };
  }

  if (!dateKey || !reserved.length) fail("Missing schedule slot", 400, "INVALID_REQUEST");
  if (isPastDateKey(dateKey) || reserved.some((index) => isSlotPastForDate(dateKey, index))) {
    fail("This time slot has already passed.", 409, "PAST_SLOT");
  }

  if (input.mode === "specific") {
    const technicianId = String(input.technicianId || "").trim();
    if (!technicianId) fail("Technician required", 400, "INVALID_REQUEST");
    await authorizeSpecificAssign(input.caller, booking, technicianId, db);
    return lockSpecificTechnician({
      db,
      bookingId,
      booking,
      technicianId,
      dateKey,
      slotLabel,
      slotIndex: reserved[0]!,
      reserved,
    });
  }

  if (input.caller.role !== "admin" && input.caller.role !== "internal" && input.caller.role !== "customer") {
    fail("Not allowed", 403, "FORBIDDEN");
  }

  const coords = getBookingLatLng(booking);
  const userLat = Number(input.userLat ?? coords.lat);
  const userLng = Number(input.userLng ?? coords.lng);
  const categoryId = String(
    input.categoryId || booking.categoryId || booking.serviceCategoryId || "",
  ).trim();
  if (!categoryId) fail("Missing service category", 400, "INVALID_REQUEST");
  if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
    fail("Booking address is missing coordinates.", 400, "INVALID_REQUEST");
  }

  const techSnap = await db.collection("technicians").get();
  const technicians = techSnap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as object),
  })) as TechnicianDoc[];
  const eligible = rankPartnersByDistance(
    fetchTechniciansMatchingCategory(technicians, categoryId).filter((tech) =>
      isAssignable(tech as unknown as Record<string, unknown>),
    ),
    userLat,
    userLng,
  );
  if (!eligible.length) fail("NO_ELIGIBLE_PARTNER", 422, "NO_ELIGIBLE_PARTNER");

  const prevTech = String(booking.technicianId || "").trim();
  if (prevTech) {
    await releaseSlotsForBooking(db, prevTech, bookingId, dateKey, reserved);
  }

  let assigned: AssignPartnerResult | null = null;
  await db.runTransaction(async (tx) => {
    for (const tech of eligible) {
      const busyRefs = reserved.map((index) =>
        db.doc(`technicians/${tech.id}/busySlots/${buildSlotDocId(dateKey, index)}`),
      );
      const busySnaps = await Promise.all(busyRefs.map((ref) => tx.get(ref)));
      if (busySnaps.some((snap) => snap.exists && isBusy(snap.data() as Record<string, unknown>))) {
        continue;
      }
      for (const [i, ref] of busyRefs.entries()) {
        tx.set(ref, {
          date: dateKey,
          slot: reserved[i] === reserved[0] ? slotLabel : slotLabelFromIndex(reserved[i]!),
          slotIndex: reserved[i],
          status: "busy",
          reason: "booking",
          bookingId,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      const phone = technicianPhone(tech as unknown as Record<string, unknown>);
      tx.update(bookingRef, {
        status: "Assigned",
        technicianId: tech.id,
        technicianName: String(tech.name ?? "").trim() || "",
        ...(phone ? { technicianPhone: phone } : {}),
        scheduledSlotDate: dateKey,
        scheduledSlotLabel: slotLabel,
        scheduledSlotIndex: reserved[0],
        reservedSlotIndices: reserved,
        updatedAt: FieldValue.serverTimestamp(),
      });
      assigned = {
        success: true,
        bookingId,
        technicianId: tech.id,
        technicianName: String(tech.name ?? "").trim() || "",
        status: "Assigned",
      };
      return;
    }
  });

  if (!assigned) fail("ALL_TECHS_BUSY", 409, "ALL_TECHS_BUSY");
  return assigned;
}

async function authorizeSpecificAssign(
  caller: ApiCaller,
  booking: Record<string, unknown>,
  technicianId: string,
  db: Firestore,
) {
  if (caller.role === "admin" || caller.role === "internal") return;
  if (caller.role !== "customer") fail("Not allowed", 403, "FORBIDDEN");
  const current = String(booking.technicianId || "").trim();
  if (current && current === technicianId) return;
  const parentId = String(booking.parentBookingId || booking.originalBookingId || "").trim();
  if (parentId) {
    const parent = await db.doc(`bookings/${parentId}`).get();
    if (parent.exists && String(parent.data()?.technicianId || "") === technicianId) return;
  }
  // Multi-service checkout: later lines reuse the partner from the first new booking.
  if (!current && String(booking.customerId || "") === caller.uid) return;
  fail("Not allowed", 403, "FORBIDDEN");
}

async function lockSpecificTechnician(params: {
  db: Firestore;
  bookingId: string;
  booking: Record<string, unknown>;
  technicianId: string;
  dateKey: string;
  slotLabel: string;
  slotIndex: number;
  reserved: number[];
}): Promise<AssignPartnerResult> {
  const { db, bookingId, booking, technicianId, dateKey, slotLabel, slotIndex, reserved } = params;
  const prevTech = String(booking.technicianId || "").trim();
  if (prevTech && prevTech !== technicianId) {
    await releaseSlotsForBooking(db, prevTech, bookingId, dateKey, reserved);
  }

  const techRef = db.doc(`technicians/${technicianId}`);
  const bookingRef = db.doc(`bookings/${bookingId}`);
  let technicianName = "";

  await db.runTransaction(async (tx) => {
    const techSnap = await tx.get(techRef);
    if (!techSnap.exists) fail("Technician profile missing.", 404, "NOT_FOUND");
    const tech = (techSnap.data() || {}) as Record<string, unknown>;
    if (!isAssignable(tech)) fail("This technician cannot be assigned.", 409, "NOT_ASSIGNABLE");
    technicianName = String(tech.name ?? "").trim() || "";
    const busyRefs = reserved.map((index) =>
      db.doc(`technicians/${technicianId}/busySlots/${buildSlotDocId(dateKey, index)}`),
    );
    const busySnaps = await Promise.all(busyRefs.map((ref) => tx.get(ref)));
    for (const snap of busySnaps) {
      if (!snap.exists) continue;
      const row = snap.data() as Record<string, unknown>;
      if (isBusy(row) && String(row.bookingId || "") !== bookingId) {
        fail("ALL_TECHS_BUSY", 409, "ALL_TECHS_BUSY");
      }
    }
    for (const [i, ref] of busyRefs.entries()) {
      tx.set(ref, {
        date: dateKey,
        slot: reserved[i] === slotIndex ? slotLabel : slotLabelFromIndex(reserved[i]!),
        slotIndex: reserved[i],
        status: "busy",
        reason: "booking",
        bookingId,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    const phone = technicianPhone(tech);
    tx.update(bookingRef, {
      status: "Assigned",
      technicianId,
      technicianName,
      ...(phone ? { technicianPhone: phone } : {}),
      scheduledSlotDate: dateKey,
      scheduledSlotLabel: slotLabel,
      scheduledSlotIndex: slotIndex,
      reservedSlotIndices: reserved,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return {
    success: true,
    bookingId,
    technicianId,
    technicianName,
    status: "Assigned",
  };
}
