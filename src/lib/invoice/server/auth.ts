import { NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

export type InvoiceAccess = {
  uid: string;
  role: "customer" | "admin" | "technician" | "internal";
};

function bearerToken(req: NextRequest): string {
  const header = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || "";
}

export async function requireInvoiceCaller(req: NextRequest): Promise<InvoiceAccess> {
  const token =
    bearerToken(req) || String(req.nextUrl.searchParams.get("access_token") || "").trim();
  if (!token) {
    throw Object.assign(new Error("Sign in required"), { status: 401 });
  }

  const internalSecrets = [
    process.env.NOTIFY_INTERNAL_SECRET,
    process.env.NOTIFY_SECRET,
  ]
    .map((s) => String(s || "").trim())
    .filter(Boolean);
  if (internalSecrets.includes(token)) {
    return { uid: "internal", role: "internal" };
  }

  let uid = "";
  try {
    const decoded = await (await getAdminAuth()).verifyIdToken(token);
    uid = String(decoded.uid || "");
  } catch {
    throw Object.assign(new Error("Invalid or expired session"), { status: 401 });
  }
  if (!uid) {
    throw Object.assign(new Error("Sign in required"), { status: 401 });
  }

  const db = getAdminDb();
  const adminSnap = await db.doc(`adminUsers/${uid}`).get();
  if (adminSnap.exists && String(adminSnap.data()?.status ?? "") === "active") {
    return { uid, role: "admin" };
  }

  const techSnap = await db.doc(`technicians/${uid}`).get();
  if (techSnap.exists) {
    return { uid, role: "technician" };
  }

  return { uid, role: "customer" };
}

export async function assertBookingAccess(
  access: InvoiceAccess,
  booking: Record<string, unknown>,
): Promise<void> {
  if (access.role === "admin" || access.role === "internal") return;
  if (access.role === "customer" && String(booking.customerId ?? "") === String(access.uid)) {
    return;
  }
  if (
    access.role === "technician" &&
    String(booking.technicianId ?? "") === String(access.uid)
  ) {
    return;
  }
  throw Object.assign(new Error("Not allowed"), { status: 403 });
}
