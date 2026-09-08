import { Container } from "@/components/container";
import { ContactDetails } from "./contact-details";

export const metadata = {
  title: "Contact",
  description: "Contact Repair Series support.",
};

export default function ContactPage() {
  return (
    <Container className="py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Contact</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Support phone and email are managed from the Admin Panel and stay in sync
        with the Customer App and Partner App.
      </p>
      <ContactDetails />
    </Container>
  );
}
