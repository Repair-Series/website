import { Suspense } from "react";
import { Container } from "@/components/container";
import { SignInForm } from "@/app/auth/sign-in-form";

export const metadata = {
  title: "Sign in",
  description: "Sign in to Repair Series to manage bookings and profile.",
};

export default function AuthPage() {
  return (
    <Container className="py-12">
      <Suspense
        fallback={
          <div className="mx-auto h-64 max-w-md animate-pulse rounded-[24px] bg-muted/60" />
        }
      >
        <SignInForm />
      </Suspense>
    </Container>
  );
}

