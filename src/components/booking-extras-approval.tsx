"use client";

import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { getDb } from "@/lib/firebase/firestore";

type ApprovalRequest = {
  status?: string;
  proposedAddOnServices?: Array<{ serviceName?: string; price?: number }>;
  proposedAdditionalServices?: Array<{ title?: string; price?: number; quantity?: number }>;
  replacementService?: {
    serviceName?: string;
    price?: number;
    previousServiceName?: string;
    previousPrice?: number;
  };
  isEdit?: boolean;
};

export function BookingExtrasApproval({
  bookingId,
  customerId,
  request,
}: {
  bookingId: string;
  customerId: string;
  request: ApprovalRequest | null | undefined;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!request || String(request.status).toLowerCase() !== "pending") return null;

  const extras = [
    ...(request.proposedAddOnServices ?? []).map((r) => ({
      name: r.serviceName ?? "Add-on",
      price: Number(r.price) || 0,
    })),
    ...(request.proposedAdditionalServices ?? []).map((r) => {
      const qty = Number(r.quantity) || 1;
      const unit = Number(r.price) || 0;
      return { name: r.title ?? "Extra", price: unit * qty };
    }),
  ];
  const replacement = request.replacementService;

  async function resolve(decision: "approved" | "rejected") {
    const db = getDb();
    if (!db) return;
    setBusy(true);
    setMsg(null);
    try {
      const ref = doc(db, "bookings", bookingId);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error("Booking not found");
      const data = snap.data();
      if (String(data.customerId) !== customerId) throw new Error("Not allowed");
      const ear = data.extrasApprovalRequest;
      if (!ear || String(ear.status).toLowerCase() !== "pending") {
        throw new Error("Already reviewed");
      }

      if (decision === "rejected") {
        await updateDoc(ref, {
          extrasApprovalRequest: { ...ear, status: "rejected" },
          updatedAt: serverTimestamp(),
        });
        setMsg("Request rejected.");
        return;
      }

      const rep = ear.replacementService;
      if (rep && typeof rep === "object") {
        const newPrice = Number(rep.price) || 0;
        const visit = Number(data.visitingCharge) || 0;
        const isEdit = ear.isEdit === true;
        const additional = Array.isArray(ear.proposedAdditionalServices)
          ? ear.proposedAdditionalServices
          : [];
        const mergedAdditional = isEdit
          ? additional
          : [...(Array.isArray(data.additionalServices) ? data.additionalServices : []), ...additional];
        const extrasSum = mergedAdditional.reduce((s: number, r: { quantity?: number; price?: number }) => {
          const qty = Number(r.quantity) || 1;
          return s + (Number(r.price) || 0) * qty;
        }, 0);
        const total = newPrice + visit + extrasSum;
        await updateDoc(ref, {
          serviceId: rep.serviceId || data.serviceId,
          serviceName: rep.serviceName || data.serviceName,
          amount: newPrice,
          servicePrice: newPrice,
          originalBookingAmount: newPrice,
          baseAmount: newPrice,
          replacedService: {
            serviceId: rep.previousServiceId || data.serviceId,
            serviceName: rep.previousServiceName || data.serviceName,
            price: Number(rep.previousPrice) || Number(data.amount) || 0,
          },
          addOnServices: [],
          ...(mergedAdditional.length ? { additionalServices: mergedAdditional } : {}),
          totalAmount: total,
          finalBookingAmount: total,
          extrasApprovalRequest: { ...ear, status: "approved" },
          updatedAt: serverTimestamp(),
        });
        setMsg("Service replacement approved.");
        return;
      }

      const addOns = Array.isArray(data.addOnServices) ? [...data.addOnServices] : [];
      const isEdit = ear.isEdit === true;
      const additional = Array.isArray(ear.proposedAdditionalServices)
        ? ear.proposedAdditionalServices
        : [];
      const mergedAdditional = [
        ...(Array.isArray(data.additionalServices) ? data.additionalServices : []),
        ...additional,
      ];
      const addOnLines = Array.isArray(ear.proposedAddOnServices) ? ear.proposedAddOnServices : [];
      const newAddOns = isEdit ? addOnLines : [...addOns, ...addOnLines];
      const base = Number(data.amount) || 0;
      const visit = Number(data.visitingCharge) || 0;
      const extrasSum = [...newAddOns, ...mergedAdditional].reduce((s, r) => {
        const qty = Number(r.quantity) || 1;
        return s + (Number(r.price) || 0) * qty;
      }, 0);
      const total = base + visit + extrasSum;

      await updateDoc(ref, {
        addOnServices: newAddOns,
        additionalServices: mergedAdditional,
        totalAmount: total,
        finalBookingAmount: total,
        extrasApprovalRequest: { ...ear, status: "approved" },
        updatedAt: serverTimestamp(),
      });
      setMsg("Extras approved.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
      <h2 className="text-lg font-bold text-amber-900">
        {request.isEdit ? "Technician updated add-on services" : "Technician requested changes"}
      </h2>
      {replacement ? (
        <div className="mt-3 text-sm text-amber-950">
          <p>
            Replace <strong>{replacement.previousServiceName}</strong> (₹
            {Number(replacement.previousPrice) || 0}) with{" "}
            <strong>{replacement.serviceName}</strong> (₹{Number(replacement.price) || 0})
          </p>
        </div>
      ) : null}
      {extras.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm text-amber-950">
          {extras.map((e, i) => (
            <li key={i}>
              {e.name} — ₹{e.price}
            </li>
          ))}
        </ul>
      ) : null}
      {msg ? <p className="mt-3 text-sm font-medium text-amber-900">{msg}</p> : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void resolve("approved")}
          className="rounded-xl bg-[#f96316] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void resolve("rejected")}
          className="rounded-xl border border-amber-300 px-5 py-2.5 text-sm font-bold text-amber-900 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
