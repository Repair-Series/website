import { getAuth } from "firebase/auth";
import { getFirebaseApp } from "@/lib/firebase/client";

export function getAuthClient() {
  const app = getFirebaseApp();
  if (!app) return null;
  return getAuth(app);
}
