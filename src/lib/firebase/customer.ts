import {
  deleteDoc,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import type { User } from "firebase/auth";

export type CustomerDoc = {
  id: string;
  uid?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  addresses?: unknown[];
  blocked?: boolean;
  totalBookings?: number;
  lastUsedAddress?: unknown;
  photoURL?: string;
  photoUrl?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export async function getCustomerProfile(
  db: Firestore,
  uid: string,
): Promise<CustomerDoc | null> {
  const snap = await getDoc(doc(db, "customers", uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Record<string, unknown>) } as CustomerDoc;
}

export async function createCustomerDocument(
  db: Firestore,
  params: {
    uid: string;
    name: string;
    email: string;
    phone: string;
  },
): Promise<void> {
  await setDoc(doc(db, "customers", params.uid), {
    uid: params.uid,
    name: params.name,
    email: params.email,
    phone: params.phone,
    address: "",
    addresses: [],
    blocked: false,
    totalBookings: 0,
    lastUsedAddress: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function touchCustomerOnLogin(db: Firestore, user: User): Promise<CustomerDoc | null> {
  const existing = await getCustomerProfile(db, user.uid);
  if (!existing) return null;

  await updateDoc(doc(db, "customers", user.uid), {
    updatedAt: serverTimestamp(),
    ...(user.email && !existing.email ? { email: user.email } : {}),
  });

  return getCustomerProfile(db, user.uid);
}

export function isCustomerBlocked(customer: CustomerDoc | null | undefined): boolean {
  return customer?.blocked === true;
}

export async function incrementCustomerBookings(
  db: Firestore,
  uid: string,
): Promise<void> {
  if (!uid) return;
  const ref = doc(db, "customers", uid);
  await updateDoc(ref, {
    totalBookings: increment(1),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCustomerDocument(
  db: Firestore,
  uid: string,
): Promise<void> {
  if (!uid) return;
  await deleteDoc(doc(db, "customers", uid));
}

export async function saveLastUsedAddress(
  db: Firestore,
  uid: string,
  address: Record<string, unknown> | null,
): Promise<void> {
  if (!uid) return;
  const ref = doc(db, "customers", uid);
  try {
    await updateDoc(ref, {
      lastUsedAddress: address || null,
      updatedAt: serverTimestamp(),
    });
  } catch {
    await setDoc(
      ref,
      { lastUsedAddress: address || null, updatedAt: serverTimestamp() },
      { merge: true },
    );
  }
}

/** Persist saved addresses — max 3, same as the mobile app. */
export async function saveCustomerAddresses(
  db: Firestore,
  uid: string,
  addresses: unknown[],
): Promise<void> {
  if (!uid) return;
  const safeList = Array.isArray(addresses) ? addresses.slice(0, 3) : [];
  const ref = doc(db, "customers", uid);
  try {
    await updateDoc(ref, {
      addresses: safeList,
      updatedAt: serverTimestamp(),
    });
  } catch {
    await setDoc(
      ref,
      { addresses: safeList, updatedAt: serverTimestamp() },
      { merge: true },
    );
  }
}

export async function updateCustomerProfile(
  db: Firestore,
  uid: string,
  updates: Record<string, unknown>,
): Promise<void> {
  if (!uid) return;
  const ref = doc(db, "customers", uid);
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}
