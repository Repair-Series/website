import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import { mapAuthError } from "@/lib/firebase/auth-errors";
import { getAuthClient } from "@/lib/firebase/auth";
import {
  createCustomerDocument,
  deleteCustomerDocument,
  getCustomerProfile,
  isCustomerBlocked,
  touchCustomerOnLogin,
} from "@/lib/firebase/customer";

export class BlockedAccountError extends Error {
  constructor() {
    super(
      "Your account has been temporarily blocked. Please contact support.",
    );
    this.name = "BlockedAccountError";
  }
}

async function ensureNotBlocked(db: Firestore, uid: string): Promise<void> {
  const customer = await getCustomerProfile(db, uid);
  if (isCustomerBlocked(customer)) {
    const auth = getAuthClient();
    if (auth) await signOut(auth);
    throw new BlockedAccountError();
  }
}

export async function signInWithEmail(
  db: Firestore,
  email: string,
  password: string,
): Promise<User> {
  const auth = getAuthClient();
  if (!auth) throw new Error("Firebase Auth is not configured.");

  try {
    const result = await signInWithEmailAndPassword(
      auth,
      email.trim().toLowerCase(),
      password,
    );
    await ensureNotBlocked(db, result.user.uid);
    await touchCustomerOnLogin(db, result.user);
    return result.user;
  } catch (error) {
    if (error instanceof BlockedAccountError) throw error;
    throw new Error(mapAuthError(error));
  }
}

export type RegisterInput = {
  name: string;
  email: string;
  phone: string;
  password: string;
};

export async function registerWithEmail(
  db: Firestore,
  input: RegisterInput,
): Promise<User> {
  const auth = getAuthClient();
  if (!auth) throw new Error("Firebase Auth is not configured.");

  const email = input.email.trim().toLowerCase();
  const phone = input.phone.replace(/\D/g, "");

  try {
    const result = await createUserWithEmailAndPassword(
      auth,
      email,
      input.password,
    );

    await updateProfile(result.user, { displayName: input.name.trim() });

    await createCustomerDocument(db, {
      uid: result.user.uid,
      name: input.name.trim(),
      email,
      phone,
    });

    return result.user;
  } catch (error) {
    throw new Error(mapAuthError(error));
  }
}

export async function sendPasswordReset(email: string): Promise<void> {
  const auth = getAuthClient();
  if (!auth) throw new Error("Firebase Auth is not configured.");

  const trimmed = email.trim().toLowerCase();
  if (!trimmed) throw new Error("Email is required.");

  try {
    await sendPasswordResetEmail(auth, trimmed);
  } catch (error) {
    throw new Error(mapAuthError(error));
  }
}

export async function logOut(): Promise<void> {
  const auth = getAuthClient();
  if (!auth) throw new Error("Firebase Auth is not configured.");
  await signOut(auth);
}

export async function deleteCurrentUserAccount(db: Firestore): Promise<void> {
  const auth = getAuthClient();
  if (!auth?.currentUser) throw new Error("You must be signed in to delete your account.");
  const user = auth.currentUser;
  try {
    await deleteCustomerDocument(db, user.uid);
    await deleteUser(user);
  } catch (error) {
    throw new Error(mapAuthError(error));
  }
}

export async function deleteAccountWithPassword(
  db: Firestore,
  password: string,
): Promise<void> {
  const auth = getAuthClient();
  if (!auth?.currentUser) throw new Error("You must be signed in to delete your account.");
  const user = auth.currentUser;
  const email = user.email;
  if (!email) throw new Error("Email is required to confirm account deletion.");

  try {
    const credential = EmailAuthProvider.credential(email, password);
    await reauthenticateWithCredential(user, credential);
    await deleteCustomerDocument(db, user.uid);
    await deleteUser(user);
  } catch (error) {
    throw new Error(mapAuthError(error));
  }
}
