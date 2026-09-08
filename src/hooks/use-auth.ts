"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { getAuthClient } from "@/lib/firebase/auth";
import {
  type CustomerDoc,
  isCustomerBlocked,
} from "@/lib/firebase/customer";
import { getDb } from "@/lib/firebase/firestore";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [customer, setCustomer] = useState<CustomerDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuthClient();
    if (!auth) {
      setLoading(false);
      return;
    }

    let customerUnsub: (() => void) | undefined;

    const authUnsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      customerUnsub?.();

      if (!u) {
        setCustomer(null);
        setLoading(false);
        return;
      }

      const db = getDb();
      if (!db) {
        setLoading(false);
        return;
      }

      customerUnsub = onSnapshot(
        doc(db, "customers", u.uid),
        (snap) => {
          setCustomer(
            snap.exists()
              ? ({ id: snap.id, ...(snap.data() as Record<string, unknown>) } as CustomerDoc)
              : null,
          );
          setLoading(false);
        },
        () => {
          setCustomer(null);
          setLoading(false);
        },
      );
    });

    return () => {
      authUnsub();
      customerUnsub?.();
    };
  }, []);

  return {
    user,
    customer,
    loading,
    isBlocked: isCustomerBlocked(customer),
  };
}
