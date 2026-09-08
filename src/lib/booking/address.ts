import type { BookingAddress } from "@/lib/booking/types";

export type AddressForm = {
  houseNumber: string;
  floor: string;
  street: string;
  landmark: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  fullAddress: string;
  lat: number | null;
  lng: number | null;
};

export function formatAddressForDisplay(
  address: BookingAddress | string | Record<string, unknown> | null | undefined,
): string {
  if (address == null || address === "") return "—";
  if (typeof address === "string") {
    const t = address.trim();
    return t || "—";
  }
  if (typeof address === "object" && !Array.isArray(address)) {
    const o = address as Record<string, unknown>;
    if (typeof o.fullAddress === "string" && o.fullAddress.trim()) {
      return o.fullAddress.trim();
    }
    if (typeof o.line1 === "string" && o.line1.trim()) {
      const parts = [o.line1, o.line2, o.city, o.state, o.pincode]
        .filter((p) => typeof p === "string" && p.trim())
        .map((p) => String(p).trim());
      if (parts.length) return parts.join(", ");
    }
    const parts = [
      o.houseNo,
      o.houseNumber,
      o.floor,
      o.street,
      o.area,
      o.landmark,
      o.city,
      o.state,
      o.pincode,
    ]
      .filter((p) => typeof p === "string" && p.trim())
      .map((p) => String(p).trim());
    if (parts.length) return parts.join(", ");
  }
  return "—";
}

export function buildLine1(form: AddressForm): string {
  return [form.houseNumber, form.floor, form.street, form.area]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
}

export function buildFullAddress(form: AddressForm): string {
  if (form.fullAddress.trim()) return form.fullAddress.trim();
  const parts = [
    buildLine1(form),
    form.landmark.trim() ? `Near ${form.landmark.trim()}` : "",
    form.city.trim(),
    form.state.trim(),
    form.pincode.trim(),
  ].filter(Boolean);
  return parts.join(", ");
}

export function addressFormToBookingAddress(form: AddressForm): BookingAddress {
  const line1 = buildLine1(form) || form.fullAddress.trim() || "Address";
  return {
    type: "Home",
    line1,
    line2: form.landmark.trim(),
    city: form.city.trim(),
    state: form.state.trim(),
    pincode: form.pincode.trim(),
    lat: form.lat ?? 0,
    lng: form.lng ?? 0,
  };
}

export function validateAddressForm(form: AddressForm): string | null {
  const full = buildFullAddress(form);
  if (!full || full.length < 10) return "Please enter a complete address.";
  if (!form.city.trim()) return "City is required.";
  if (!form.pincode.trim() || !/^\d{6}$/.test(form.pincode.trim())) {
    return "Enter a valid 6-digit pincode.";
  }
  if (form.lat == null || form.lng == null) {
    return "Location coordinates are required. Use current location or confirm address.";
  }
  return null;
}

export const EMPTY_ADDRESS_FORM: AddressForm = {
  houseNumber: "",
  floor: "",
  street: "",
  landmark: "",
  area: "",
  city: "Gurugram",
  state: "Haryana",
  pincode: "",
  fullAddress: "",
  lat: null,
  lng: null,
};
