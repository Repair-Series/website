"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Loader2,
  MapPin,
  Navigation,
  Pencil,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "@/context/location-context";

type SavedAddress = {
  id?: string;
  label?: string;
  type?: string;
  city?: string;
  state?: string;
  pincode?: string;
  street?: string;
  area?: string;
  fullAddress?: string;
  lat?: number;
  lng?: number;
};

export function HeaderLocationDropdown() {
  const { customer } = useAuth();
  const { label, loading, refreshFromGps, applySavedAddress } = useLocation();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const savedAddresses = (Array.isArray(customer?.addresses)
    ? customer.addresses
    : []) as SavedAddress[];

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const onDetect = async () => {
    setError("");
    try {
      await refreshFromGps();
      setOpen(false);
    } catch {
      setError("Could not detect location. Please try again or change manually.");
    }
  };

  return (
    <div ref={ref} className="relative w-[280px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-4 text-left hover:border-gray-300"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <div className="flex min-w-0 items-center gap-2.5 text-gray-600">
          <MapPin className="size-4.5 shrink-0" />
          <span className="truncate text-[15px]">{label}</span>
        </div>
        <ChevronDown
          className={`size-4 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[100] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="border-b border-gray-100 px-4 py-3">
            <div className="text-xs font-bold uppercase tracking-wide text-[#64748b]">
              Your location
            </div>
            <div className="mt-1 truncate text-sm font-medium text-[#0a0f1c]">{label}</div>
          </div>

          <div className="p-2">
            <button
              type="button"
              onClick={() => void onDetect()}
              disabled={loading}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#0a0f1c] transition-colors hover:bg-orange-50 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin text-[#f96316]" />
              ) : (
                <Navigation className="size-4 text-[#f96316]" />
              )}
              Detect Again
            </button>

            <Link
              href="/book"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#0a0f1c] transition-colors hover:bg-orange-50"
            >
              <Pencil className="size-4 text-[#f96316]" />
              Change Location
            </Link>
          </div>

          {savedAddresses.length > 0 ? (
            <div className="border-t border-gray-100 p-2">
              <div className="px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#64748b]">
                Saved Addresses
              </div>
              {savedAddresses.map((addr, idx) => {
                const addrLabel =
                  String(addr.label ?? addr.type ?? "Address").trim() ||
                  `Address ${idx + 1}`;
                const sub = [
                  addr.area,
                  addr.city,
                  addr.pincode,
                ]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <button
                    key={addr.id ?? `${addrLabel}-${idx}`}
                    type="button"
                    onClick={() => {
                      applySavedAddress({
                        label: addrLabel,
                        lat: addr.lat,
                        lng: addr.lng,
                        city: addr.city,
                        state: addr.state,
                        pincode: addr.pincode,
                        street: addr.street,
                        area: addr.area,
                        fullAddress: addr.fullAddress,
                      });
                      setOpen(false);
                    }}
                    className="flex w-full flex-col rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-orange-50"
                  >
                    <span className="font-medium text-[#0a0f1c]">{addrLabel}</span>
                    {sub ? (
                      <span className="truncate text-xs text-[#64748b]">{sub}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          {error ? (
            <div className="border-t border-gray-100 px-4 py-2 text-xs text-red-600">
              {error}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
