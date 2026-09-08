"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AuthError,
  AuthField,
  AuthShell,
  AuthSuccess,
} from "@/components/auth/auth-shell";
import { validateEmail } from "@/lib/auth-validation";
import { sendPasswordReset } from "@/lib/firebase/auth-actions";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const validationError = validateEmail(email);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      await sendPasswordReset(email);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Forgot password"
      subtitle="We'll send a password reset link to your email."
    >
      {error ? <AuthError message={error} /> : null}
      {success ? (
        <AuthSuccess message="Password reset email sent. Check your inbox and follow the link." />
      ) : null}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <AuthField
          label="Email address"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="Enter email address"
          autoComplete="email"
        />

        <Button
          type="submit"
          size="lg"
          className="w-full rounded-full"
          disabled={loading || success}
        >
          {loading ? "Sending..." : "Send reset link"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[#64748b]">
        <Link href="/auth" className="font-semibold text-[#f96316] hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
