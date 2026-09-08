"use client";

import { useMemo, useState } from "react";
import { Loader2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  EMPTY_ADDRESS_FORM,
  buildFullAddress,
  formatAddressForDisplay,
  type AddressForm,
} from "@/lib/booking/address";
import { getDb } from "@/lib/firebase/firestore";
import { saveCustomerAddresses } from "@/lib/firebase/customer";
import { geocodeAddressString, reverseGeocode } from "@/lib/geocode";
import { MapPinPicker } from "@/components/map-pin-picker";

type SavedAddress = Record<string, unknown> & {
  id?: string;
  fullAddress?: string;
  line1?: string;
  city?: string;
  pincode?: string;
  lat?: number;
  lng?: number;
};

function toForm(addr: SavedAddress | null): AddressForm {
  if (!addr) return { ...EMPTY_ADDRESS_FORM };
  return {
    houseNumber: String(addr.houseNumber || addr.line1 || "").trim(),
    floor: String(addr.floor || "").trim(),
    street: String(addr.street || "").trim(),
    landmark: String(addr.landmark || addr.line2 || "").trim(),
    area: String(addr.area || "").trim(),
    city: String(addr.city || "").trim(),
    state: String(addr.state || "").trim(),
    pincode: String(addr.pincode || "").trim(),
    fullAddress: String(addr.fullAddress || formatAddressForDisplay(addr) || "").trim(),
    lat: Number.isFinite(Number(addr.lat)) ? Number(addr.lat) : null,
    lng: Number.isFinite(Number(addr.lng)) ? Number(addr.lng) : null,
  };
}

function formToSaved(form: AddressForm, id?: string): SavedAddress {
  const fullAddress = buildFullAddress(form);
  return {
    id: id || `addr_${Date.now()}`,
    type: "Home",
    line1: [form.houseNumber, form.floor, form.street, form.area].filter(Boolean).join(", ") || fullAddress,
    line2: form.landmark,
    houseNumber: form.houseNumber,
    floor: form.floor,
    street: form.street,
    area: form.area,
    landmark: form.landmark,
    city: form.city,
    state: form.state,
    pincode: form.pincode,
    fullAddress,
    ...(form.lat != null ? { lat: form.lat } : {}),
    ...(form.lng != null ? { lng: form.lng } : {}),
  };
}

export default function AddressesPage() {
  const { user, customer } = useAuth();
  const db = useMemo(() => getDb(), []);
  const savedList: SavedAddress[] = Array.isArray(customer?.addresses)
    ? (customer!.addresses as SavedAddress[])
    : [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressForm>({ ...EMPTY_ADDRESS_FORM });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const startAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_ADDRESS_FORM });
    setOpen(true);
    setError(null);
  };

  const startEdit = (addr: SavedAddress, index: number) => {
    setEditingId(String(addr.id || `idx_${index}`));
    setForm(toForm(addr));
    setOpen(true);
    setError(null);
  };

  const persist = async (next: SavedAddress[]) => {
    if (!db || !user) throw new Error("Sign in required.");
    await saveCustomerAddresses(db, user.uid, next.slice(0, 3));
  };

  const onSave = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      let nextForm = { ...form };
      if (nextForm.lat == null || nextForm.lng == null) {
        const geo = await geocodeAddressString(buildFullAddress(nextForm));
        if (geo) {
          nextForm = { ...nextForm, lat: geo.lat, lng: geo.lng };
        }
      }
      if (nextForm.lat == null || nextForm.lng == null) {
        throw new Error("Set a map pin or use current location so we can assign nearby partners.");
      }
      const saved = formToSaved(nextForm, editingId || undefined);
      let next = [...savedList];
      if (editingId) {
        const idx = next.findIndex((a, i) => String(a.id || `idx_${i}`) === editingId);
        if (idx >= 0) next[idx] = saved;
        else next = [saved, ...next];
      } else {
        next = [saved, ...next].slice(0, 3);
      }
      await persist(next);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save address.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (index: number) => {
    if (!user || !window.confirm("Delete this address?")) return;
    setSaving(true);
    try {
      const next = savedList.filter((_, i) => i !== index);
      await persist(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete.");
    } finally {
      setSaving(false);
    }
  };

  const useCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported on this device.");
      return;
    }
    setLocating(true);
    setError(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
        });
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const rev = await reverseGeocode(lat, lng);
      setForm((f) => ({
        ...f,
        lat,
        lng,
        city: rev?.city || f.city,
        state: rev?.state || f.state,
        pincode: rev?.pincode || f.pincode,
        area: rev?.area || f.area,
        fullAddress: rev?.fullAddress || f.fullAddress,
      }));
    } catch {
      setError("Could not read your location. Allow location permission and try again.");
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#0a0f1c]">Saved Addresses</h1>
          <p className="mt-2 text-sm text-[#64748b]">
            Add up to 3 addresses — same list as the Repair Series app.
          </p>
        </div>
        <button
          type="button"
          onClick={startAdd}
          disabled={savedList.length >= 3}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[#C45508] px-5 text-sm font-bold text-white disabled:opacity-50"
        >
          <Plus className="size-4" /> Add address
        </button>
      </div>

      {error && !open ? (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      ) : null}

      {savedList.length === 0 && !open ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-[24px] border border-dashed border-gray-200 bg-gray-50 py-16 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-orange-50">
            <MapPin className="size-6 text-[#f96316]" />
          </div>
          <p className="font-medium text-[#0a0f1c]">No saved addresses yet</p>
          <p className="mt-1 max-w-sm text-sm text-[#64748b]">
            Add a home or office address with a map pin for faster booking.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {savedList.map((item, idx) => (
            <div
              key={String(item.id || idx)}
              className="rounded-[20px] border border-black/5 bg-white p-5 shadow-sm"
            >
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[#f96316]">
                Saved address {idx + 1}
              </div>
              <p className="text-sm leading-relaxed text-[#0a0f1c]">
                {formatAddressForDisplay(item)}
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(item, idx)}
                  className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold"
                >
                  <Pencil className="size-3.5" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => void onDelete(idx)}
                  className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600"
                >
                  <Trash2 className="size-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {open ? (
        <div className="mt-8 space-y-4 rounded-[24px] border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold">{editingId ? "Edit address" : "Add address"}</h2>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="button"
            onClick={() => void useCurrentLocation()}
            disabled={locating}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-[#C45508]/40 px-4 text-sm font-bold text-[#C45508]"
          >
            {locating ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
            Use current location
          </button>

          <MapPinPicker
            lat={form.lat}
            lng={form.lng}
            onChange={(lat, lng) => setForm((f) => ({ ...f, lat, lng }))}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["houseNumber", "House / Flat"],
                ["floor", "Floor"],
                ["street", "Street"],
                ["landmark", "Landmark"],
                ["area", "Area"],
                ["city", "City"],
                ["state", "State"],
                ["pincode", "Pincode"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-xs font-medium text-[#64748b]">
                {label}
                <input
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="mt-1 h-11 w-full rounded-xl border px-3 text-sm text-[#0a0f1c]"
                />
              </label>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-11 rounded-full border px-5 text-sm font-bold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void onSave()}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#C45508] px-6 text-sm font-bold text-white"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Save address
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
