"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ChevronRight, CreditCard, MessageSquareWarning } from "lucide-react";
import type { BookingDoc } from "@/lib/booking/types";
import { getCustomerTotal } from "@/lib/booking/finance";

function hasPendingPayment(booking: BookingDoc) {
  const pr = booking.paymentRequest as
    | { status?: string; method?: string; amount?: number }
    | undefined;
  return (
    !!pr &&
    String(pr.status).toLowerCase() === "pending" &&
    String(pr.method).toLowerCase() === "rs_app"
  );
}

function hasPendingApproval(booking: BookingDoc) {
  const ear = booking.extrasApprovalRequest as { status?: string } | undefined;
  return !!ear && String(ear.status).toLowerCase() === "pending";
}

/** Home teaser — links to booking detail for pending RS-app payment. */
export function BookingPaymentHomeBanner({
  bookings,
}: {
  bookings: BookingDoc[];
}) {
  const pending = useMemo(
    () => bookings.filter((b) => b?.id && hasPendingPayment(b)),
    [bookings],
  );

  if (!pending.length) return null;

  const first = pending[0];
  const pr = first.paymentRequest as { amount?: number } | undefined;
  const amount =
    Number(pr?.amount) ||
    getCustomerTotal(first) ||
    Number(first.amount) ||
    0;

  return (
    <div className="mx-4 mb-3 rounded-2xl border border-orange-200 bg-[#FFF7ED] p-4 shadow-sm">
      <div className="flex gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[#C45508]">
          <CreditCard className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-[#1A1A1A]">Payment requested</p>
          <p className="mt-1 text-xs leading-relaxed text-[#6B6B6B]">
            Your partner sent a ₹{Math.round(amount)} payment request. Tap to pay.
          </p>
          <Link
            href={`/dashboard/bookings/${first.id}`}
            className="mt-3 inline-flex items-center gap-1 rounded-xl bg-[#C45508] px-4 py-2 text-xs font-bold text-white"
          >
            Pay now
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Home teaser — links to booking detail for pending extras approval. */
export function BookingApprovalBanner({
  bookings,
}: {
  bookings: BookingDoc[];
}) {
  const pending = useMemo(
    () => bookings.filter((b) => b?.id && hasPendingApproval(b)),
    [bookings],
  );

  if (!pending.length) return null;

  const first = pending[0];
  const extra = pending.length - 1;

  return (
    <div className="mx-4 mb-3 rounded-2xl border border-[#a53500]/35 bg-[#fff7ed] p-4 shadow-sm">
      <div className="flex gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#a53500]/12 text-[#a53500]">
          <MessageSquareWarning className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-[#292524]">Booking update request</p>
          <p className="mt-1 text-xs leading-relaxed text-[#78716c]">
            Partner requested additional work or services.
          </p>
          {extra > 0 ? (
            <p className="mt-1 text-xs font-bold text-[#a53500]">
              + {extra} more request{extra === 1 ? "" : "s"}
            </p>
          ) : null}
          <Link
            href={`/dashboard/bookings/${first.id}`}
            className="mt-3 inline-flex items-center gap-1 rounded-xl bg-[#a53500] px-4 py-2 text-xs font-bold text-white"
          >
            View details
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
