import { Container } from "@/components/container";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy",
  description:
    "Repair Series refund and cancellation policy for appliance repair and home services.",
  alternates: { canonical: "https://www.repairseries.in/refund" },
};

export default function RefundPage() {
  return (
    <Container className="py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Refund Policy</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        This page will contain your production refund and cancellation policy
        copy. Visiting charges, spare parts, and completed job work may follow
        different refund rules — contact support for case-specific help.
      </p>
      <div className="mt-8 max-w-3xl space-y-4 text-sm leading-relaxed text-[#475569]">
        <p>
          If a technician visit is cancelled before arrival, eligible visiting
          charges may be refunded as per the booking terms shown at checkout.
        </p>
        <p>
          For payment disputes or incomplete work, email{" "}
          <a
            href="mailto:support@repairseries.in"
            className="font-medium text-[#f96316] hover:underline"
          >
            support@repairseries.in
          </a>{" "}
          with your booking ID.
        </p>
      </div>
    </Container>
  );
}
