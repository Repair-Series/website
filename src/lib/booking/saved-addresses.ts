import type { AddressForm } from "@/lib/booking/address";
import { addressFormToBookingAddress, buildFullAddress } from "@/lib/booking/address";

export const MAX_SAVED_ADDRESSES = 3;

export type SavedAddress = {
  id?: string;
  type?: string;
  fullAddress?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  lat?: number;
  lng?: number;
  houseNumber?: string;
  street?: string;
  area?: string;
  landmark?: string;
  floor?: string;
};

function addressKey(a: SavedAddress | Record<string, unknown>): string {
  const full = String(
    (a as SavedAddress).fullAddress ||
      (a as SavedAddress).line1 ||
      "",
  )
    .trim()
    .toLowerCase();
  if (full) return full;
  const lat = Number((a as SavedAddress).lat);
  const lng = Number((a as SavedAddress).lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `${lat.toFixed(5)},${lng.toFixed(5)}`;
  }
  return "";
}

export function normalizeSavedAddressList(raw: unknown): SavedAddress[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a) => a && typeof a === "object")
    .map((a, i) => {
      const o = a as SavedAddress;
      return {
        ...o,
        id: o.id || `addr_${i}`,
        fullAddress: String(o.fullAddress || o.line1 || "").trim(),
      };
    })
    .filter((a) => a.fullAddress || (Number.isFinite(Number(a.lat)) && Number.isFinite(Number(a.lng))))
    .slice(0, MAX_SAVED_ADDRESSES);
}

/** Prepend address and dedupe by fullAddress / coords — max 3 like the app. */
export function upsertSavedAddress(
  existing: unknown,
  next: SavedAddress,
): SavedAddress[] {
  const list = normalizeSavedAddressList(existing);
  const key = addressKey(next);
  const filtered = key
    ? list.filter((a) => addressKey(a) !== key)
    : list;
  return [next, ...filtered].slice(0, MAX_SAVED_ADDRESSES);
}

export function bookingAddressFromForm(form: AddressForm): SavedAddress {
  const booking = addressFormToBookingAddress(form);
  const fullAddress = buildFullAddress(form);
  return {
    id: `addr_${Date.now()}`,
    type: booking.type || "Home",
    fullAddress,
    line1: booking.line1,
    line2: booking.line2,
    city: booking.city,
    state: booking.state,
    pincode: booking.pincode,
    lat: booking.lat,
    lng: booking.lng,
    houseNumber: form.houseNumber,
    street: form.street,
    area: form.area,
    landmark: form.landmark,
    floor: form.floor,
  };
}

export function savedAddressToForm(addr: SavedAddress): AddressForm {
  return {
    houseNumber: String(addr.houseNumber || "").trim(),
    floor: String(addr.floor || "").trim(),
    street: String(addr.street || addr.line1 || "").trim(),
    landmark: String(addr.landmark || addr.line2 || "").trim(),
    area: String(addr.area || "").trim(),
    city: String(addr.city || "Gurugram").trim() || "Gurugram",
    state: String(addr.state || "Haryana").trim() || "Haryana",
    pincode: String(addr.pincode || "").trim(),
    fullAddress: String(addr.fullAddress || addr.line1 || "").trim(),
    lat: Number.isFinite(Number(addr.lat)) ? Number(addr.lat) : null,
    lng: Number.isFinite(Number(addr.lng)) ? Number(addr.lng) : null,
  };
}
