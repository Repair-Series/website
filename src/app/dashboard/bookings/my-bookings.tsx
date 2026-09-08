"use client";

import { collection, onSnapshot, query, where } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { formatAddressForDisplay } from "@/lib/booking/address";
import {
  DASHBOARD_TABS,
  getStatusColor,
  getStatusLabel,
  normalizeStatus,
  type DashboardTabKey,
} from "@/lib/booking/status";
import type { BookingDoc } from "@/lib/booking/types";
import { getCustomerTotal } from "@/lib/booking/finance";
import { getDb } from "@/lib/firebase/firestore";
import { canClaimRevisit } from "@/lib/booking/revisit";
import { SectionPromoBanner } from "@/components/home/promo-banner";

export function MyBookings() {
  const { user, loading: authLoading } = useAuth();
  const db = useMemo(() => getDb(), []);

  const [active, setActive] = useState<DashboardTabKey>("upcoming");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState<BookingDoc[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!db) {
      setError("Firebase is not configured.");
      setLoading(false);
      return;
    }
    if (!user) {
      setAll([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(collection(db, "bookings"), where("customerId", "==", user.uid));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: BookingDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Record<string, unknown>),
        }));
        rows.sort((a, b) => {
          const at = a.createdAt?.toDate?.()?.getTime() ?? 0;
          const bt = b.createdAt?.toDate?.()?.getTime() ?? 0;
          return bt - at;
        });
        setAll(rows);
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [authLoading, db, user]);

  const filtered = useMemo(() => {
    const tab = DASHBOARD_TABS.find((t) => t.key === active) ?? DASHBOARD_TABS[0];
    return all.filter((b) => {
      const st = normalizeStatus(b.status);
      if (tab.key === "accepted") {
        return st === "new" || st === "pending";
      }
      return tab.statuses.includes(st as never);
    });
  }, [active, all]);

  if (error) {
    return (
      <div className="mt-6 rounded-2xl border bg-card p-6">
        <div className="text-sm font-medium">Couldn&apos;t load bookings</div>
        <div className="mt-2 text-sm text-muted-foreground">{error}</div>
      </div>
    );
  }

  return (
    <div className="mt-6 md:mt-8">
      <div className="-mx-4 mb-2 md:mx-0">
        <SectionPromoBanner section="bookings" />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {DASHBOARD_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={[
              "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-all",
              active === t.key
                ? "border-[#f96316] bg-[#f96316] text-white"
                : "hover:border-[#f96316]/30 hover:bg-orange-50",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-40 animate-pulse rounded-2xl border bg-card" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-6 rounded-2xl border bg-card p-8 text-center">
          <div className="text-sm font-medium">No bookings in this section</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Book a service to get started.
          </div>
          <Link href="/services" className="mt-4 inline-block">
            <Button variant="outline" size="lg">
              Browse services
            </Button>
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {filtered.map((b) => (
            <Link
              key={b.id}
              href={`/dashboard/bookings/${b.id}`}
              className="group rounded-2xl border bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-[#0a0f1c]">
                    {b.serviceName ?? "Service"}
                  </div>
                  <div className="mt-1 text-xs text-[#64748b]">
                    {b.bookingCode ?? `ID: ${b.id.slice(-8).toUpperCase()}`}
                  </div>
                </div>
                <span
                  className={[
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                    getStatusColor(b.status),
                  ].join(" ")}
                >
                  {getStatusLabel(b.status)}
                </span>
              </div>

              <div className="mt-4 grid gap-1 text-sm text-[#64748b]">
                <div>
                  <span className="font-medium text-[#0a0f1c]">Date:</span>{" "}
                  {b.bookingDate ?? b.date ?? "—"}
                </div>
                <div>
                  <span className="font-medium text-[#0a0f1c]">Slot:</span>{" "}
                  {b.slot ?? b.time ?? "—"}
                </div>
                <div className="line-clamp-2">
                  <span className="font-medium text-[#0a0f1c]">Address:</span>{" "}
                  {formatAddressForDisplay(b.address)}
                </div>
                <div>
                  <span className="font-medium text-[#0a0f1c]">Total:</span> ₹
                  {getCustomerTotal(b)}
                </div>
              </div>

              {canClaimRevisit(b as unknown as Record<string, unknown>) ? (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-bold text-green-700">
                  Free revisit available — tap to claim
                </div>
              ) : null}

              <div className="mt-4 flex items-center text-sm font-semibold text-[#f96316] md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
                View details <ArrowRight className="ml-1 size-4" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
