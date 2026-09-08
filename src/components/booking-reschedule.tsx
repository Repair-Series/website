"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { rescheduleBooking } from "@/lib/booking/reschedule";
import {
  formatDateKeyLabel,
  getDateOptions,
  type BookingSlotDef,
} from "@/lib/booking/slots";
import { useRealtimeAvailableSlots } from "@/hooks/use-realtime-available-slots";
import type { BookingDoc, ServiceDoc } from "@/lib/booking/types";
import { getDb } from "@/lib/firebase/firestore";
import { loadService } from "@/lib/services/helpers";

type Props = {
  booking: BookingDoc;
  bookingId: string;
};

export function BookingReschedulePanel({ booking, bookingId }: Props) {
  const { user } = useAuth();
  const db = useMemo(() => getDb(), []);
  const [open, setOpen] = useState(false);
  const [service, setService] = useState<ServiceDoc | null>(null);
  const [dateKey, setDateKey] = useState("");
  const [slot, setSlot] = useState<BookingSlotDef | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const status = String(booking.status ?? "").trim();
  const canReschedule = ["New", "Assigned", "pending"].includes(status);

  const addr = (booking.address || {}) as { lat?: number; lng?: number };
  const lat = Number(addr.lat);
  const lng = Number(addr.lng);

  useEffect(() => {
    if (!db || !booking.serviceId || !open) return;
    let cancelled = false;
    void loadService(db, String(booking.serviceId)).then((s) => {
      if (!cancelled) setService(s);
    });
    return () => {
      cancelled = true;
    };
  }, [db, booking.serviceId, open]);

  const dateOptions = useMemo(() => getDateOptions(), []);
  const effectiveDate = dateKey || dateOptions[0]?.key || "";

  const { availableSlots, loading: slotsLoading } = useRealtimeAvailableSlots({
    service,
    dateKey: effectiveDate,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    enabled: open && canReschedule,
  });

  if (!canReschedule) return null;

  const onSave = async () => {
    if (!db || !user || !slot) return;
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      await rescheduleBooking(db, {
        bookingId,
        customerId: user.uid,
        dateKey: effectiveDate,
        slotId: slot.id,
        slotIndex: slot.slotIndex,
      });
      setOk("Booking rescheduled.");
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reschedule.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-[24px] border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-[#0a0f1c]">Reschedule</h2>
      <p className="mt-2 text-sm text-[#64748b]">
        Pick a new date and time while the booking is still upcoming.
      </p>
      {ok ? <p className="mt-2 text-sm text-green-700">{ok}</p> : null}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      {!open ? (
        <Button
          className="mt-4 rounded-full bg-[#C45508] text-white hover:bg-[#a84606]"
          onClick={() => {
            setOpen(true);
            setDateKey(dateOptions[0]?.key || "");
            setSlot(null);
          }}
        >
          <Calendar className="mr-2 size-4" />
          Reschedule visit
        </Button>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {dateOptions.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => {
                  setDateKey(d.key);
                  setSlot(null);
                }}
                className={[
                  "rounded-full border px-3 py-1.5 text-xs font-bold",
                  effectiveDate === d.key
                    ? "border-[#C45508] bg-orange-50 text-[#C45508]"
                    : "",
                ].join(" ")}
              >
                {formatDateKeyLabel(d.key)}
              </button>
            ))}
          </div>

          {slotsLoading ? (
            <div className="flex items-center gap-2 text-sm text-[#64748b]">
              <Loader2 className="size-4 animate-spin" /> Loading slots…
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableSlots.length === 0 ? (
                <p className="text-sm text-[#64748b]">No slots available for this day.</p>
              ) : (
                availableSlots.map((s) => (
                  <button
                    key={s.id || String(s.slotIndex)}
                    type="button"
                    onClick={() => setSlot(s)}
                    className={[
                      "rounded-full border px-3 py-1.5 text-xs font-bold",
                      slot?.slotIndex === s.slotIndex
                        ? "border-[#C45508] bg-orange-50 text-[#C45508]"
                        : "",
                    ].join(" ")}
                  >
                    {s.label}
                  </button>
                ))
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              className="rounded-full bg-[#C45508] text-white"
              disabled={!slot || saving}
              onClick={() => void onSave()}
            >
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Confirm new time
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
