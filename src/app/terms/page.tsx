import { Container } from "@/components/container";
import { CustomerLegalBody } from "@/components/legal/customer-legal-body";

export const metadata = {
  title: "Terms",
  description: "Repair Series terms and conditions.",
};

export default function TermsPage() {
  return (
    <Container className="py-12">
      <h1 className="text-3xl font-semibold tracking-tight">
        Terms & Conditions
      </h1>
      <CustomerLegalBody kind="terms" />
    </Container>
  );
}
