"use client";

import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { RemoteImage as Image } from "@/components/remote-image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Star, User, Loader2, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { formatAddressForDisplay } from "@/lib/booking/address";
import { getCustomerTotal } from "@/lib/booking/finance";
import { BookingExtrasApproval } from "@/components/booking-extras-approval";
import { BookingPaymentRequestBanner } from "@/components/booking-payment-request";
import { cancelBookingByUser } from "@/lib/booking/allocation";
import { downloadOwnInvoicePdf } from "@/lib/invoice/download-client";
import {
  getBookingTimeline,
  getStatusColor,
  getStatusLabel,
} from "@/lib/booking/status";
import type { BookingDoc, TechnicianDoc } from "@/lib/booking/types";
import { getDb } from "@/lib/firebase/firestore";
import { canClaimRevisit, getRevisitRemaining } from "@/lib/booking/revisit";
import { getBookPath } from "@/lib/catalog/slug";
import { BookingReschedulePanel } from "@/components/booking-reschedule";

export function BookingDetail({ bookingId }: { bookingId: string }) {
  const { user, loading: authLoading } = useAuth();
  const db = useMemo(() => getDb(), []);

  const [booking, setBooking] = useState<BookingDoc | null>(null);
  const [technician, setTechnician] = useState<TechnicianDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [serviceRevisitPolicy, setServiceRevisitPolicy] = useState<
    Record<string, unknown> | null
  >(null);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, "settings", "general"), (snap) => {
      const url = snap.exists() ? String(snap.data()?.googleReviewUrl ?? "").trim() : "";
      setGoogleReviewUrl(url);
    });
    return () => unsub();
  }, [db]);

  useEffect(() => {
    if (authLoading) return;
    if (!db) {
      setError("Firebase is not configured.");
      setLoading(false);
      return;
    }
    if (!user) {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      doc(db, "bookings", bookingId),
      (snap) => {
        if (!snap.exists()) {
          setBooking(null);
          setLoading(false);
          return;
        }
        const data = { id: snap.id, ...(snap.data() as Record<string, unknown>) } as BookingDoc;
        const ownerId = data.customerId ?? data.userId;
        if (ownerId && ownerId !== user.uid) {
          setError("You do not have access to this booking.");
          setBooking(null);
        } else {
          setBooking(data);
          setError(null);
        }
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [authLoading, bookingId, db, user]);

  useEffect(() => {
    if (!db || !booking?.technicianId) {
      setTechnician(null);
      return;
    }
    const unsub = onSnapshot(doc(db, "technicians", booking.technicianId), (snap) => {
      if (snap.exists()) {
        setTechnician({ id: snap.id, ...(snap.data() as object) });
      } else {
        setTechnician(null);
      }
    });
    return () => unsub();
  }, [db, booking?.technicianId]);

  useEffect(() => {
    if (!db || !booking?.serviceId) {
      setServiceRevisitPolicy(null);
      return;
    }
    const policy = (booking as { revisitPolicy?: { enabled?: boolean } }).revisitPolicy;
    if (policy?.enabled === true) {
      setServiceRevisitPolicy(null);
      return;
    }
    let cancelled = false;
    void getDoc(doc(db, "services", String(booking.serviceId)))
      .then((snap) => {
        if (cancelled) return;
        if (!snap.exists()) {
          setServiceRevisitPolicy(null);
          return;
        }
        const data = snap.data() as { revisitPolicy?: Record<string, unknown> };
        setServiceRevisitPolicy(data.revisitPolicy || null);
      })
      .catch(() => {
        if (!cancelled) setServiceRevisitPolicy(null);
      });
    return () => {
      cancelled = true;
    };
  }, [db, booking?.serviceId, (booking as { revisitPolicy?: { enabled?: boolean } } | null)?.revisitPolicy?.enabled]);

  if (loading) {
    return <div className="h-96 animate-pulse rounded-[24px] bg-muted/50" />;
  }

  if (error || !booking) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center">
        <p className="font-medium">{error ?? "Booking not found"}</p>
        <Link href="/dashboard/bookings" className="mt-4 inline-block text-sm text-[#f96316] underline">
          Back to bookings
        </Link>
      </div>
    );
  }

  const timeline = getBookingTimeline(booking);
  const total = getCustomerTotal(booking);
  const serviceCharge = Number(booking.amount) || 0;
  const visitingCharge = Number(booking.visitingCharge) || 0;
  const statusNorm = String(booking.status ?? "").trim();
  const canCancel = ["New", "Assigned", "pending"].includes(statusNorm);
  const showOtp =
    statusNorm === "Assigned" &&
    booking.otp != null &&
    String(booking.otp).trim() !== "";
  const bookingRecord = booking as unknown as Record<string, unknown>;
  const effectivePolicy =
    (bookingRecord.revisitPolicy as Record<string, unknown> | undefined) ||
    serviceRevisitPolicy ||
    undefined;
  const canClaimFreeRevisit = canClaimRevisit(bookingRecord, effectivePolicy);
  const revisitLeft = getRevisitRemaining(bookingRecord, effectivePolicy);

  const onCancel = async () => {
    if (!db || !user) return;
    if (!window.confirm("Cancel this booking?")) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelBookingByUser(db, bookingId, user.uid);
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : "Could not cancel");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="pb-16">
      <Link
        href="/dashboard/bookings"
        className="mb-6 inline-flex items-center text-sm font-semibold text-[#64748b] hover:text-[#f96316]"
      >
        <ArrowLeft className="mr-2 size-4" /> My bookings
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="rounded-[24px] border bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-[#0a0f1c]">
                  {booking.serviceName ?? "Service"}
                </h1>
                <p className="mt-1 text-sm text-[#64748b]">
                  Booking ID: {booking.bookingCode ?? booking.id}
                </p>
              </div>
              <span
                className={[
                  "rounded-full px-3 py-1 text-sm font-medium",
                  getStatusColor(booking.status),
                ].join(" ")}
              >
                {getStatusLabel(booking.status)}
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Info label="Date" value={booking.bookingDate ?? booking.date ?? "—"} />
              <Info label="Time slot" value={booking.slot ?? booking.time ?? "—"} />
              <Info label="Address" value={formatAddressForDisplay(booking.address)} wide />
              <Info label="Service charge" value={`₹${serviceCharge}`} />
              <Info label="Visiting charge" value={`₹${visitingCharge}`} />
              <Info label="Total" value={`₹${total}`} />
            </div>

            {String(booking.status).toLowerCase() === "completed" ? (
              <div className="mt-6 border-t border-slate-100 pt-5">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  disabled={invoiceBusy || !user}
                  onClick={() => {
                    void (async () => {
                      if (!user) return;
                      setInvoiceBusy(true);
                      setInvoiceError(null);
                      try {
                        const token = await user.getIdToken();
                        if (!booking.invoiceId && !booking.invoiceNumber) {
                          const generated = await fetch("/api/invoices/generate", {
                            method: "POST",
                            headers: {
                              Authorization: `Bearer ${token}`,
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                              bookingId,
                              force: false,
                              sendEmail: false,
                            }),
                          });
                          const payload = (await generated.json().catch(() => ({}))) as {
                            error?: string;
                          };
                          if (!generated.ok) {
                            throw new Error(payload.error || "Invoice is not ready yet");
                          }
                        }
                        await downloadOwnInvoicePdf({
                          bookingId,
                          token,
                          fileName: booking.invoiceNumber
                            ? `${booking.invoiceNumber}.pdf`
                            : undefined,
                        });
                      } catch (e) {
                        setInvoiceError(
                          e instanceof Error ? e.message : "Could not download invoice",
                        );
                      } finally {
                        setInvoiceBusy(false);
                      }
                    })();
                  }}
                >
                  {invoiceBusy ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" /> Preparing invoice
                    </>
                  ) : (
                    <>
                      <FileDown className="mr-2 size-4" /> Download invoice
                    </>
                  )}
                </Button>
                {booking.invoiceNumber ? (
                  <p className="mt-2 text-xs text-[#64748b]">
                    Invoice {booking.invoiceNumber}
                  </p>
                ) : null}
                {invoiceError ? (
                  <p className="mt-2 text-sm text-red-600">{invoiceError}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          {showOtp ? (
            <div className="rounded-[24px] border border-purple-200 bg-purple-50 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-[#0a0f1c]">Service OTP</h2>
              <p className="mt-2 text-sm text-[#64748b]">
                Share this OTP with your technician when they arrive.
              </p>
              <p className="mt-3 text-3xl font-black tracking-widest text-[#0a0f1c]">
                {String(booking.otp)}
              </p>
            </div>
          ) : null}

          {user ? (
            <BookingPaymentRequestBanner booking={booking} customerId={user.uid} />
          ) : null}

          {technician ? (
            <div className="rounded-[24px] border bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-[#0a0f1c]">Your technician</h2>
              <div className="mt-4 flex items-center gap-4">
                <div className="relative size-16 overflow-hidden rounded-full bg-gray-100">
                  {technician.profilePhotoUrl ? (
                    <Image
                      src={technician.profilePhotoUrl}
                      alt={technician.name ?? "Technician"}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center">
                      <User className="size-8 text-gray-400" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-bold text-[#0a0f1c]">
                    {technician.name ?? "Technician"}
                  </div>
                  {typeof technician.rating === "number" ? (
                    <div className="mt-1 flex items-center gap-1 text-sm text-[#64748b]">
                      <Star className="size-4 fill-yellow-400 text-yellow-400" />
                      {technician.rating.toFixed(1)}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {user ? (
            <BookingExtrasApproval
              bookingId={bookingId}
              customerId={user.uid}
              request={booking.extrasApprovalRequest as Record<string, unknown> | undefined}
            />
          ) : null}

          {String(booking.status).toLowerCase() === "completed" && googleReviewUrl ? (
            <div className="rounded-[24px] border border-yellow-200 bg-yellow-50 p-6 text-center shadow-sm">
              <h2 className="text-lg font-bold text-[#0a0f1c]">Rate Your Experience</h2>
              <p className="mt-2 text-sm text-[#64748b]">
                Help others discover Repair Series on Google.
              </p>
              <a
                href={googleReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#C45508] px-6 py-3 text-sm font-bold text-white"
              >
                Leave Google Review
              </a>
            </div>
          ) : null}

          {canClaimFreeRevisit ? (
            <div className="rounded-[24px] border border-orange-200 bg-orange-50 p-6 text-center shadow-sm">
              <h2 className="text-lg font-bold text-[#0a0f1c]">Free revisit available</h2>
              <p className="mt-2 text-sm text-[#64748b]">
                Same technician will handle this revisit. Remaining: {revisitLeft}
              </p>
              <Link
                href={`${getBookPath({ id: String(booking.serviceId || ""), name: String(booking.serviceName || "") })}?revisitFrom=${bookingId}`}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#C45508] px-6 py-3 text-sm font-bold text-white"
              >
                Claim Free Revisit
              </Link>
            </div>
          ) : null}

          <BookingReschedulePanel booking={booking} bookingId={bookingId} />

          {canCancel ? (
            <div className="rounded-[24px] border bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-[#0a0f1c]">Cancel booking</h2>
              <p className="mt-2 text-sm text-[#64748b]">
                You can cancel while the booking is upcoming or assigned.
              </p>
              {cancelError ? (
                <p className="mt-2 text-sm text-red-600">{cancelError}</p>
              ) : null}
              <Button
                variant="outline"
                className="mt-4 rounded-full border-red-200 text-red-700 hover:bg-red-50"
                disabled={cancelling}
                onClick={() => void onCancel()}
              >
                {cancelling ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Cancelling...
                  </>
                ) : (
                  "Cancel booking"
                )}
              </Button>
            </div>
          ) : null}

          <div className="rounded-[24px] border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[#0a0f1c]">Live status</h2>
            <div className="mt-6 ml-2 space-y-0 border-l-2 border-[#f96316]/20 pl-6">
              {timeline.map((step) => (
                <div key={step.key} className="relative pb-8 last:pb-0">
                  <span
                    className={[
                      "absolute -left-[31px] top-0 flex size-6 items-center justify-center rounded-full ring-4 ring-white",
                      step.done
                        ? "bg-[#25D366] text-white"
                        : step.active
                          ? "bg-[#f96316] text-white"
                          : "bg-gray-200",
                    ].join(" ")}
                  >
                    {step.done ? <Check className="size-3.5" /> : null}
                  </span>
                  <div
                    className={[
                      "font-semibold",
                      step.active ? "text-[#f96316]" : "text-[#0a0f1c]",
                    ].join(" ")}
                  >
                    {step.label}
                  </div>
                  {step.at ? (
                    <div className="mt-0.5 text-xs text-[#64748b]">
                      {step.at.toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[24px] border bg-orange-50/50 p-6">
            <div className="text-sm font-bold uppercase tracking-wide text-[#f96316]">
              Payment summary
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#64748b]">Service charge</span>
                <span>₹{serviceCharge}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748b]">Visiting charge</span>
                <span>₹{visitingCharge}</span>
              </div>
              <div className="flex justify-between border-t border-orange-200 pt-2">
                <span className="text-[#64748b]">Total</span>
                <span className="font-bold text-[#0a0f1c]">₹{total}</span>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border bg-white p-6 text-sm text-[#64748b]">
            Status updates appear here in real time — same as the mobile app.
          </div>
        </aside>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <div className="text-xs font-medium uppercase tracking-wide text-[#64748b]">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-[#0a0f1c]">{value}</div>
    </div>
  );
}
