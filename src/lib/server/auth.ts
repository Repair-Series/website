import { NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

export type CallerRole = "customer" | "technician" | "admin" | "internal";

export type ApiCaller = {
  uid: string;
  role: CallerRole;
};

function bearerToken(req: NextRequest): string {
  const header = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || "";
}

function internalSecrets(): string[] {
  return [
    process.env.NOTIFY_INTERNAL_SECRET,
    process.env.NOTIFY_SECRET,
    process.env.CRON_SECRET,
  ]
    .map((s) => String(s || "").trim())
    .filter(Boolean);
}

/** Server-to-server. Never accept NEXT_PUBLIC_* secrets. */
export function tryInternalAuth(req: NextRequest): ApiCaller | null {
  const token = bearerToken(req);
  if (!token) return null;
  if (internalSecrets().includes(token)) {
    return { uid: "internal", role: "internal" };
  }
  return null;
}

export async function requireApiCaller(req: NextRequest): Promise<ApiCaller> {
  const internal = tryInternalAuth(req);
  if (internal) return internal;

  const token = bearerToken(req);
  if (!token) {
    throw Object.assign(new Error("Sign in required"), { status: 401 });
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

export function assertBookingAccess(
  caller: ApiCaller,
  booking: Record<string, unknown>,
): void {
  if (caller.role === "internal" || caller.role === "admin") return;
  if (caller.role === "customer" && String(booking.customerId ?? "") === caller.uid) {
    return;
  }
  if (
    caller.role === "technician" &&
    String(booking.technicianId ?? "") === caller.uid
  ) {
    return;
  }
  throw Object.assign(new Error("Not allowed"), { status: 403 });
}

export function requireAdminOrInternal(caller: ApiCaller): void {
  if (caller.role === "admin" || caller.role === "internal") return;
  throw Object.assign(new Error("Not allowed"), { status: 403 });
}
