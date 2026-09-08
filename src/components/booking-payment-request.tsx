"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmRsAppPayment } from "@/lib/booking/booking-payment";
import { getCustomerTotal } from "@/lib/booking/finance";
import type { BookingDoc } from "@/lib/booking/types";
import { getDb } from "@/lib/firebase/firestore";

type Props = {
  booking: BookingDoc;
  customerId: string;
};

export function BookingPaymentRequestBanner({ booking, customerId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const pr = booking.paymentRequest as
    | { status?: string; method?: string; amount?: number }
    | undefined;
  const pending =
    pr &&
    String(pr.status).toLowerCase() === "pending" &&
    String(pr.method).toLowerCase() === "rs_app";

  if (!pending || done) return null;

  const amount =
    Number(pr.amount) ||
    getCustomerTotal(booking) ||
    Number(booking.amount) ||
    0;

  const onPay = async () => {
    const db = getDb();
    if (!db) return;
    setLoading(true);
    setError(null);
    try {
      await confirmRsAppPayment(db, {
        bookingId: String(booking.id),
        customerId,
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-[24px] border border-orange-200 bg-orange-50 p-6 shadow-sm">
      <h2 className="text-lg font-bold text-[#0a0f1c]">Payment requested</h2>
      <p className="mt-2 text-sm text-[#64748b]">
        Your partner sent a ₹{Math.round(amount)} payment request. Confirm payment
        in the app — same as the mobile booking flow.
      </p>
      {error ? (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      ) : null}
      <Button
        className="mt-4 rounded-full"
        disabled={loading}
        onClick={() => void onPay()}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" /> Processing...
          </>
        ) : (
          "Confirm payment"
        )}
      </Button>
    </div>
  );
}
