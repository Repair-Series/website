"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AuthError,
  AuthField,
  AuthShell,
} from "@/components/auth/auth-shell";
import {
  clearAuthReturnUrl,
  getAuthReturnUrl,
} from "@/lib/booking/draft";
import { validateSignUp } from "@/lib/auth-validation";
import { registerWithEmail } from "@/lib/firebase/auth-actions";
import { getDb } from "@/lib/firebase/firestore";

export function CreateAccountForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useMemo(() => getDb(), []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const returnUrl =
    searchParams.get("return") || getAuthReturnUrl() || "/dashboard/bookings";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validateSignUp({
      name,
      email,
      phone,
      password,
      confirmPassword,
      agreedToTerms,
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!db) {
      setError("Firebase is not configured.");
      return;
    }

    setLoading(true);
    try {
      await registerWithEmail(db, { name, email, phone, password });
      clearAuthReturnUrl();
      router.replace(returnUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create account"
      subtitle="Join Repair Series — book trusted home repair across Gurugram, Hyderabad & Aligarh."
    >
      {error ? <AuthError message={error} /> : null}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <AuthField
          label="Full name"
          value={name}
          onChange={setName}
          placeholder="Enter full name"
          autoComplete="name"
        />
        <AuthField
          label="Email address"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="Enter email address"
          autoComplete="email"
        />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#0a0f1c]">
            Mobile number
          </label>
          <div className="flex gap-2">
            <span className="inline-flex h-11 items-center rounded-xl border border-gray-200 bg-muted/50 px-3 text-sm font-medium">
              +91
            </span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter mobile number"
              autoComplete="tel"
              className="h-11 flex-1 rounded-xl border border-gray-200 bg-background px-4 text-sm outline-none transition-all focus-visible:border-[#f96316] focus-visible:ring-2 focus-visible:ring-[#f96316]/20"
            />
          </div>
        </div>
        <AuthField
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="Minimum 6 characters"
          autoComplete="new-password"
        />
        <AuthField
          label="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Re-enter password"
          autoComplete="new-password"
        />

        <label className="flex cursor-pointer items-start gap-3 text-sm text-[#64748b]">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="mt-0.5 size-4 rounded border-gray-300 text-[#f96316] focus:ring-[#f96316]"
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" className="font-medium text-[#f96316] underline">
              Terms &amp; Conditions
            </Link>
          </span>
        </label>

        <Button
          type="submit"
          size="lg"
          className="w-full rounded-full"
          disabled={loading}
        >
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[#64748b]">
        Already have an account?{" "}
        <Link
          href={`/auth${searchParams.get("return") ? `?return=${encodeURIComponent(searchParams.get("return")!)}` : ""}`}
          className="font-semibold text-[#f96316] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
