import Link from "next/link";
import { Container } from "@/components/container";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata = {
  title: "Account help",
  description: "Repair Series now uses mobile OTP login.",
};

export default function ForgotPasswordPage() {
  return (
    <Container className="py-12">
      <AuthShell
        title="Password login has moved"
        subtitle="Customers now sign in with a mobile number and OTP. No password reset is needed."
      >
        <Link
          href="/auth"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#f96316] text-sm font-bold text-white"
        >
          Continue with mobile OTP
        </Link>
      </AuthShell>
    </Container>
  );
}
