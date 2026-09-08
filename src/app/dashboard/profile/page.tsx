"use client";

import Link from "next/link";
import { RemoteImage as Image } from "@/components/remote-image";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { SectionPromoBanner } from "@/components/home/promo-banner";
import { getDb } from "@/lib/firebase/firestore";
import { updateCustomerProfile } from "@/lib/firebase/customer";
import { uploadImage } from "@/lib/media/upload";

export default function ProfilePage() {
  const { user, customer } = useAuth();
  const db = useMemo(() => getDb(), []);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    setName(String(customer?.name || user?.displayName || ""));
    setEmail(String(customer?.email || user?.email || ""));
    setPhotoURL(String(customer?.photoURL || customer?.photoUrl || ""));
  }, [customer, user]);

  const onSave = async () => {
    if (!db || !user) return;
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const trimmedName = name.trim();
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedName) throw new Error("Name is required.");
      if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        throw new Error("Enter a valid email for invoices and updates.");
      }
      await updateCustomerProfile(db, user.uid, {
        name: trimmedName,
        email: trimmedEmail,
        ...(photoURL ? { photoURL, photoUrl: photoURL } : {}),
      });
      setOk("Profile updated.");
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  const onPhoto = async (file: File | null) => {
    if (!file || !db || !user) return;
    setUploading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const uploaded = await uploadImage(file, { kind: "profile-user", token });
      setPhotoURL(uploaded.url);
      await updateCustomerProfile(db, user.uid, {
        photoURL: uploaded.url,
        photoUrl: uploaded.url,
      });
      setOk("Photo updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Photo upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="-mx-4 mb-2 md:mx-0">
        <SectionPromoBanner section="account" />
      </div>
      <h1 className="text-2xl font-extrabold tracking-tight text-[#0a0f1c] md:text-3xl md:font-bold">
        My Profile
      </h1>
      <p className="mt-2 text-sm text-[#64748b]">
        Your account details — shared with the Repair Series mobile app.
      </p>

      <div className="mt-8 rounded-[24px] border border-black/5 bg-white/90 p-6 shadow-sm backdrop-blur-sm sm:p-8">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="relative size-20 overflow-hidden rounded-full bg-orange-50 ring-2 ring-[#C45508]/20">
            {photoURL ? (
              <Image src={photoURL} alt="" fill className="object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-2xl font-bold text-[#C45508]">
                {(name || "U").slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <label className="inline-flex h-10 cursor-pointer items-center rounded-full border px-4 text-sm font-bold">
            {uploading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" /> Uploading…
              </>
            ) : (
              "Change photo"
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => void onPhoto(e.target.files?.[0] || null)}
            />
          </label>
        </div>

        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
        {ok ? <p className="mb-3 text-sm text-green-700">{ok}</p> : null}

        {!editing ? (
          <>
            <dl className="grid gap-5 sm:grid-cols-2">
              <ProfileField label="Full name" value={customer?.name || user?.displayName || "—"} />
              <ProfileField label="Email" value={customer?.email || user?.email || "—"} />
              <ProfileField label="Mobile" value={customer?.phone || "—"} />
              <ProfileField
                label="Total bookings"
                value={String(customer?.totalBookings ?? 0)}
              />
              <ProfileField
                label="Account status"
                value={customer?.blocked ? "Blocked" : "Active"}
              />
            </dl>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-6 inline-flex h-11 items-center rounded-full bg-[#C45508] px-6 text-sm font-bold text-white"
            >
              Edit profile
            </button>
          </>
        ) : (
          <div className="space-y-4">
            <label className="block text-xs font-bold uppercase tracking-wide text-[#64748b]">
              Full name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border px-3 text-sm font-medium text-[#0a0f1c]"
              />
            </label>
            <label className="block text-xs font-bold uppercase tracking-wide text-[#64748b]">
              Email (invoices)
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border px-3 text-sm font-medium text-[#0a0f1c]"
              />
            </label>
            <p className="text-xs text-[#64748b]">
              Mobile number is your login identity and cannot be changed here.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="h-11 rounded-full border px-5 text-sm font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void onSave()}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#C45508] px-6 text-sm font-bold text-white"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                Save
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/delete-account"
            className="inline-flex items-center text-sm font-semibold text-red-600 hover:underline"
          >
            Delete my account
          </Link>
        </div>
      </div>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-[#64748b]">
        {label}
      </dt>
      <dd className="mt-1 text-base font-medium text-[#0a0f1c]">{value}</dd>
    </div>
  );
}
