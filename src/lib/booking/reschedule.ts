import {
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import {
  assignExistingTechnicianAndLockBusySlot,
  assignNearestTechnicianAndLockBusySlot,
  releaseBusySlotForBooking,
} from "@/lib/booking/allocation";
import { getAuthClient } from "@/lib/firebase/auth";
import { isPastDateKey, isSlotPast, resolveBookingSlot } from "@/lib/booking/slots";
import { slotLabelFromIndex } from "@/lib/booking/technician-slots";
import { getServiceCategoryId } from "@/lib/booking/slot-availability";
import { loadService } from "@/lib/services/helpers";

function scheduledAtFromLocalSlot(dateKey: string, startHour: number): Date {
  const parts = String(dateKey).trim().split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return new Date(NaN);
  }
  const [y, m, d] = parts;
  return new Date(y, m - 1, d, startHour, 0, 0, 0);
}

/**
 * Reschedule a New/Assigned booking to a new date + slot.
 * Releases the previous busy slot and re-locks for the same technician when possible.
 */
export async function rescheduleBooking(
  db: Firestore,
  params: {
    bookingId: string;
    customerId: string;
    dateKey: string;
    slotId?: string;
    slotIndex?: number;
  },
): Promise<void> {
  const liveUser = getAuthClient()?.currentUser;
  if (!liveUser) {
    throw Object.assign(new Error("Sign in required"), { status: 401 });
  }
  const bookingId = String(params.bookingId || "").trim();
  const customerId = liveUser.uid;
  if (params.customerId && params.customerId !== customerId) {
    throw Object.assign(new Error("Not allowed"), { status: 403 });
  }
  if (!bookingId) throw new Error("Missing booking or customer.");

  const slot = resolveBookingSlot(params.slotId, params.slotIndex);
  if (!slot) throw new Error("Invalid time slot selected.");
  if (isPastDateKey(params.dateKey)) throw new Error("Cannot reschedule to a past date.");
  if (isSlotPast(params.dateKey, slot)) {
    throw new Error("This time slot has already passed. Please choose a future slot.");
  }

  const ref = doc(db, "bookings", bookingId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Booking not found.");
  const data = {
    id: snap.id,
    ...(snap.data() as Record<string, unknown>),
  } as Record<string, unknown> & { id: string };
  if (String(data.customerId ?? "") !== customerId) {
    throw new Error("Not allowed.");
  }

  const status = String(data.status ?? "").trim();
  if (!["New", "Assigned", "pending"].includes(status)) {
    throw new Error("Only upcoming bookings can be rescheduled.");
  }

  const addr = (data.address || {}) as { lat?: number; lng?: number };
  const userLat = Number(addr.lat);
  const userLng = Number(addr.lng);

  const scheduledAtDate = scheduledAtFromLocalSlot(params.dateKey, slot.startHour);
  if (Number.isNaN(scheduledAtDate.getTime())) {
    throw new Error("Invalid booking date.");
  }

  const slotLabel = slot.label || slotLabelFromIndex(slot.slotIndex);
  const previousTechId = String(data.technicianId || "").trim();

  await releaseBusySlotForBooking(db, data);

  await updateDoc(ref, {
    scheduledAt: Timestamp.fromDate(scheduledAtDate),
    scheduledSlotDate: params.dateKey,
    scheduledSlotLabel: slotLabel,
    scheduledSlotIndex: slot.slotIndex,
    scheduleDateKey: params.dateKey,
    scheduleSlotIndex: Math.max(0, slot.slotIndex - 1),
    slotStartHour: slot.startHour,
    date: params.dateKey,
    time: slotLabel,
    slot: slotLabel,
    bookingDate: params.dateKey,
    updatedAt: serverTimestamp(),
    rescheduledAt: serverTimestamp(),
  });

  try {
    if (previousTechId && status === "Assigned") {
      try {
        await assignExistingTechnicianAndLockBusySlot(db, {
          bookingId,
          technicianId: previousTechId,
          dateStr: params.dateKey,
          slotIndex: slot.slotIndex,
          slotLabel,
        });
        return;
      } catch (e) {
        const err = e as Error & { code?: string };
        if (err.code !== "ALL_TECHS_BUSY") throw e;
      }
    }

    const serviceId = String(data.serviceId || "").trim();
    if (!serviceId) {
      return;
    }

    const service = await loadService(db, serviceId);
    if (!service) throw new Error("Service not found for reschedule.");
    const categoryId =
      String(data.categoryId || data.serviceCategoryId || "").trim() ||
      getServiceCategoryId(service);

    await assignNearestTechnicianAndLockBusySlot(db, {
      bookingId,
      categoryId,
      service,
      userLat,
      userLng,
      dateStr: params.dateKey,
      slotIndex: slot.slotIndex,
      slotLabel,
    });
  } catch (e) {
    const err = e as Error & { code?: string };
    if (err.code === "ALL_TECHS_BUSY" || err.code === "PAST_SLOT") {
      throw new Error(
        "This slot is no longer available. Please select another slot.",
      );
    }
    if (err.code === "ASSIGN_PERMISSION_DENIED" || err.code === "permission-denied") {
      throw new Error("Booking assignment permission denied");
    }
    if (err.code === "NO_ELIGIBLE_PARTNER") {
      throw new Error("No partner is currently available for this slot.");
    }
    throw e;
  }
}
