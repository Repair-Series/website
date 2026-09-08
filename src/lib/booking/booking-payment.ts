import { getAuthClient } from "@/lib/firebase/auth";

export async function confirmRsAppPayment(
  _db: unknown,
  params: { bookingId: string; customerId: string },
): Promise<void> {
  const { bookingId, customerId } = params;
  if (!bookingId || !customerId) throw new Error("Missing booking or customer");

  const auth = getAuthClient();
  const user = auth?.currentUser;
  if (!user) throw new Error("Sign in required");
  if (String(user.uid) !== String(customerId)) {
    throw new Error("Not allowed");
  }

  const token = await user.getIdToken();
  const response = await fetch("/api/bookings/confirm-payment", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bookingId }),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(data.error || "Payment confirmation failed.");
  }
}
