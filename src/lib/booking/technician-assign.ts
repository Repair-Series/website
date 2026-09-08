import type { Firestore } from "firebase/firestore";
import {
  reserveBusySlotsForBooking,
  verifyBusySlotsFree,
} from "@/lib/booking/busy-slots";
import {
  findTechnicianForSlot,
  getServiceCategoryId,
  slotToDescriptor,
} from "@/lib/booking/slot-availability";
import type { SlotDescriptor } from "@/lib/booking/technician-slots";
import type { BookingSlotDef } from "@/lib/booking/slots";
import type { ServiceDoc } from "@/lib/booking/types";
import { getBookingLatLng } from "@/lib/geo";

export {
  findTechnicianForSlot,
  getServiceCategoryId,
  loadTechnicians,
} from "@/lib/booking/slot-availability";
export { verifyBusySlotsFree, reserveBusySlotsForBooking };

export async function assignTechnicianForBookingSlot(
  db: Firestore,
  params: {
    service: ServiceDoc;
    dateKey: string;
    slot: BookingSlotDef;
    bookingLatLng: { lat: number; lng: number };
    platformRadiusKm: number;
  },
): Promise<string | null> {
  return findTechnicianForSlot(db, {
    service: params.service,
    dateKey: params.dateKey,
    slotIndex: params.slot.slotIndex,
    bookingLatLng: params.bookingLatLng,
    platformRadiusKm: params.platformRadiusKm,
  });
}

export function latLngFromBookingPayload(payload: Record<string, unknown>) {
  return getBookingLatLng(payload);
}

export function descriptorsForSlot(
  dateKey: string,
  slot: BookingSlotDef,
): SlotDescriptor[] {
  return [slotToDescriptor(dateKey, slot)];
}
