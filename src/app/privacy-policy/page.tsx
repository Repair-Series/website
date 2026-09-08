import { Container } from "@/components/container";
import { CustomerLegalBody } from "@/components/legal/customer-legal-body";

export const metadata = {
  title: "Privacy Policy",
  description: "Repair Series privacy policy.",
};

export default function PrivacyPolicyPage() {
  return (
    <Container className="py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <CustomerLegalBody kind="privacy" />
    </Container>
  );
}
