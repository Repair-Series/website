"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import type { ServiceDoc } from "@/lib/booking/types";
import { getDb } from "@/lib/firebase/firestore";
import { onLocationChanged } from "@/lib/location/events";

export type CatalogCategory = {
  id: string;
  name?: string;
  title?: string;
  slug?: string;
  icon?: string;
  active?: boolean;
  isActive?: boolean;
};

type CatalogContextValue = {
  services: ServiceDoc[];
  categories: CatalogCategory[];
  loading: boolean;
  version: number;
};

const CatalogContext = createContext<CatalogContextValue | null>(null);

function isActiveService(s: ServiceDoc): boolean {
  return String(s.status ?? "Active") === "Active";
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [services, setServices] = useState<ServiceDoc[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const db = getDb();
    if (!db) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const load = async () => {
      try {
        const [catSnap, svcSnap] = await Promise.all([
          getDocs(query(collection(db, "categories"), orderBy("name", "asc"))),
          getDocs(query(collection(db, "services"), orderBy("name", "asc"))),
        ]);
        if (!mounted) return;
        setCategories(
          catSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as CatalogCategory)
            .filter((c) => c.active !== false && c.isActive !== false),
        );
        setServices(
          svcSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as ServiceDoc)
            .filter(isActiveService),
        );
      } catch {
        /* optional */
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [version]);

  useEffect(() => {
    return onLocationChanged(() => setVersion((v) => v + 1));
  }, []);

  const value = useMemo(
    () => ({ services, categories, loading, version }),
    [services, categories, loading, version],
  );

  return (
    <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
  );
}

export function useCatalog(): CatalogContextValue {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("useCatalog must be used within CatalogProvider");
  return ctx;
}
