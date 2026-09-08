export type CheckoutQuote = {
  ok: true;
  formulaVersion: "v2";
  catalog: { serviceId: string; serviceName: string; unitPrice: number; quantity: number; amount: number } | null;
  settings: {
    customerPlatformFeeType: "fixed" | "percent";
    customerPlatformFeeValue: number;
    gstEnabled: boolean;
    gstPercent: number;
    serviceCommissionPercent: number;
    additionalServiceCommissionPercent: number;
    sparePartCommissionPercent: number;
  };
  customer: {
    serviceSubtotal: number;
    platformFee: number;
    discount: number;
    taxableAmount: number;
    totalTax: number;
    finalPayable: number;
  };
  snapshot: Record<string, unknown>;
};

export async function fetchCheckoutQuote(input: {
  token: string;
  serviceId: string;
  variationId?: string;
  quantity?: number;
  couponCode?: string;
  discountAmount?: number;
}): Promise<CheckoutQuote> {
  const res = await fetch("/api/checkout/calculate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      serviceId: input.serviceId,
      variationId: input.variationId || undefined,
      quantity: input.quantity || 1,
      couponCode: input.couponCode || undefined,
      discountAmount: input.discountAmount,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as CheckoutQuote & { error?: string };
  if (!res.ok || !json.ok) {
    throw new Error(json.error || "Could not confirm the booking amount.");
  }
  return json;
}
