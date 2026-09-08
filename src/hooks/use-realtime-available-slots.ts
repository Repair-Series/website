"use client";

import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import type { BookingSlotDef } from "@/lib/booking/slots";
import {
  computeVisibleSlots,
  type BusySlotEntry,
  type SlotVisibilityDebug,
} from "@/lib/booking/slot-allocation";
import { getServiceCategoryId, loadGeneralSettings, loadTechnicians } from "@/lib/booking/slot-availability";
import type { ServiceDoc } from "@/lib/booking/types";
import { getDb } from "@/lib/firebase/firestore";

const DEV = process.env.NODE_ENV !== "production";

function logSlotDebug(debug: SlotVisibilityDebug) {
  if (!DEV) return;
  console.info("[slots]", {
    date: debug.dateKey,
    category: debug.categoryId,
    radiusKm: debug.radiusKm,
    categoryMatch: debug.categoryMatchCount,
    inRadius: debug.eligibleCount,
    hiddenPast: debug.pastFiltered,
    hiddenAllBusy: debug.fullyBusy,
    visible: debug.visibleCount,
  });
}

export function useRealtimeAvailableSlots(params: {
  service: ServiceDoc | null;
  dateKey: string;
  lat: number | null;
  lng: number | null;
  enabled: boolean;
}) {
  const { service, dateKey, lat, lng, enabled } = params;
  const db = useMemo(() => getDb(), []);

  const [availableSlots, setAvailableSlots] = useState<BookingSlotDef[]>([]);
  const [loading, setLoading] = useState(false);
  const [emptyReason, setEmptyReason] = useState<string | null>(null);

  useEffect(() => {
    if (
      !enabled ||
      !db ||
      !service ||
      !dateKey?.trim() ||
      lat == null ||
      lng == null ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      setAvailableSlots([]);
      setLoading(false);
      setEmptyReason(null);
      return;
    }

    let cancelled = false;
    const unsubs: Array<() => void> = [];

    let allTechnicians: Awaited<ReturnType<typeof loadTechnicians>> = [];
    let radiusKm = 25;
    let busyByTech: Record<string, BusySlotEntry[]> = {};
    const categoryId = getServiceCategoryId(service);

    const recompute = () => {
      if (cancelled) return;
      const { slots, debug } = computeVisibleSlots({
        categoryId,
        userLat: lat,
        userLng: lng,
        dateKey: dateKey.trim(),
        radiusKm,
        allTechnicians,
        busyByTech,
      });
      logSlotDebug(debug);
      setAvailableSlots(slots);
      setLoading(false);
      if (slots.length === 0) {
        if (!categoryId) {
          setEmptyReason("Service category is missing.");
        } else if (debug.categoryMatchCount === 0) {
          setEmptyReason("No technicians match this service category in your area.");
        } else if (debug.eligibleCount === 0) {
          setEmptyReason(
            `No technicians within ${radiusKm} km of your address. Try updating your location.`,
          );
        } else if (debug.pastFiltered >= 10) {
          setEmptyReason("All slots for today have passed. Please pick another date.");
        } else {
          setEmptyReason("All slots are booked for this date. Try another day.");
        }
      } else {
        setEmptyReason(null);
      }
    };

    setLoading(true);

    (async () => {
      try {
        const settings = await loadGeneralSettings(db);
        radiusKm =
          Number(settings.defaultTechnicianServiceRadiusKm) > 0
            ? Number(settings.defaultTechnicianServiceRadiusKm)
            : 25;
        allTechnicians = await loadTechnicians(db);
        if (cancelled) return;

        if (!categoryId) {
          setAvailableSlots([]);
          setEmptyReason("Service category is missing.");
          setLoading(false);
          return;
        }

        const categoryTechs = allTechnicians.filter((t) => {
          const c = categoryId;
          const data = t as Record<string, unknown>;
          const single = String(data.categoryId ?? "").trim();
          if (single && single === c) return true;
          const primary = String(data.primaryCategoryId ?? "").trim();
          if (primary && primary === c) return true;
          const arr = Array.isArray(data.categoryIds) ? data.categoryIds : [];
          return arr.some((x) => String(x).trim() === c);
        });

        if (categoryTechs.length === 0) {
          setAvailableSlots([]);
          setEmptyReason("No technicians match this service category in your area.");
          setLoading(false);
          return;
        }

        for (const tech of categoryTechs) {
          unsubs.push(
            onSnapshot(
              collection(db, "technicians", tech.id, "busySlots"),
              (snap) => {
                busyByTech[tech.id] = snap.docs.map((d) => ({
                  id: d.id,
                  ...(d.data() as object),
                }));
                recompute();
              },
              (err) => {
                if (DEV) console.warn("[slots] busySlots listener error", tech.id, err);
              },
            ),
          );
        }

        recompute();
      } catch (e) {
        if (!cancelled) {
          if (DEV) console.error("[slots] load error", e);
          setAvailableSlots([]);
          setEmptyReason("Could not load time slots. Please try again.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [db, service, dateKey, lat, lng, enabled]);

  return { availableSlots, loading, emptyReason };
}
