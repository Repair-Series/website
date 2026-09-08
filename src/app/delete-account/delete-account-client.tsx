"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, ShieldAlert, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { getDb } from "@/lib/firebase/firestore";
import { deleteCurrentUserAccount, logOut } from "@/lib/firebase/auth-actions";
import { CART_STORAGE_KEY } from "@/lib/cart/storage";
import {
  LOCATION_ONBOARDING_KEY,
  USER_LOCATION_KEY,
} from "@/lib/location/user-location";

type Step = "warning" | "confirm";

export default function DeleteAccountClient() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [step, setStep] = useState<Step>("warning");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showFinalDialog, setShowFinalDialog] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/auth");
  }, [loading, user, router]);

  const clearLocalSessions = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(CART_STORAGE_KEY);
    localStorage.removeItem(USER_LOCATION_KEY);
    localStorage.removeItem(LOCATION_ONBOARDING_KEY);
    sessionStorage.clear();
  };

  const onDelete = async () => {
    const db = getDb();
    if (!db) {
      setError("Firebase is not configured.");
      return;
    }
    setDeleting(true);
    setError("");
    try {
      await deleteCurrentUserAccount(db);
      clearLocalSessions();
      await logOut().catch(() => {});
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete account.");
      setDeleting(false);
      setShowFinalDialog(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex justify-center py-16">
        <div className="size-10 animate-spin rounded-full border-4 border-gray-100 border-t-red-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 mb-10">
      {/* Top Navigation */}
      <Link
        href="/dashboard/profile"
        className="group mb-8 inline-flex items-center text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="mr-2 size-4 transition-transform group-hover:-translate-x-1" />
        Back to My Account
      </Link>

      {/* Main Professional Danger Zone Card */}
      <div className="overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm">
        
        {/* Header Section */}
        <div className="border-b border-red-100 bg-red-50/50 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-red-100 p-3 text-red-600">
              <ShieldAlert className="size-6 shrink-0" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Delete Account</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
                This will permanently remove your Repair Series account and all associated data.
                <span className="mt-1 block font-medium text-red-600">This action cannot be undone.</span>
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Body Section */}
        <div className="p-6 sm:p-8">
          {step === "warning" ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-medium text-gray-900">What happens next?</h2>
                <ul className="mt-4 space-y-3">
                  {[
                    "Your authentication account will be permanently deleted.",
                    "Your customer profile and saved addresses will be removed.",
                    "Active bookings may still be visible to support for legal/service reasons.",
                    "You will be signed out immediately on all devices.",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                      <AlertCircle className="mt-0.5 size-4 shrink-0 text-gray-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="pt-4">
                <Button
                  variant="destructive"
                  className="w-full sm:w-auto"
                  onClick={() => setStep("confirm")}
                >
                  I understand, continue to deletion
                </Button>
              </div>
            </div>
          ) : null}

          {step === "confirm" ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-medium text-gray-900">Final Confirmation</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Please type <strong className="font-semibold text-gray-900">DELETE</strong> to permanently remove your account.
                </p>
              </div>
              <div className="space-y-2">
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm uppercase text-gray-900 transition-colors focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="DELETE"
                />
                {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep("warning")}>
                  Back
                </Button>
                <Button
                  variant="destructive"
                  disabled={confirmText !== "DELETE"}
                  onClick={() => setShowFinalDialog(true)}
                >
                  Permanently Delete Account
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Refined Modal Dialog */}
      {showFinalDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm transition-opacity">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md animate-in zoom-in-95 rounded-2xl bg-white p-6 shadow-2xl duration-200"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-red-100 p-2 text-red-600">
                <AlertTriangle className="size-6 shrink-0" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Are you absolutely sure?</h3>
                <p className="mt-2 text-sm text-gray-500">
                  This action will permanently delete your account, and you will lose all your data.
                </p>
              </div>
            </div>
            <div className="mt-8 flex gap-3 sm:justify-end">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                disabled={deleting}
                onClick={() => setShowFinalDialog(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="w-full sm:w-auto"
                disabled={deleting}
                onClick={() => void onDelete()}
              >
                {deleting ? "Deleting..." : "Yes, delete my account"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}