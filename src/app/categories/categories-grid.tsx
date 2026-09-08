"use client";

import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { RemoteImage as Image } from "@/components/remote-image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getCategoryPath } from "@/lib/catalog/slug";
import { getDb } from "@/lib/firebase/firestore";

type CategoryDoc = {
  id: string;
  name?: string;
  title?: string;
  image?: string;
  icon?: string;
  slug?: string;
  active?: boolean;
  isActive?: boolean;
};

function getCategoryName(c: CategoryDoc) {
  return c.name ?? c.title ?? "Category";
}

function getCategoryImage(c: CategoryDoc) {
  return c.icon ?? c.image ?? null;
}

export function CategoriesGrid() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryDoc[]>([]);

  const categoriesCol = useMemo(() => {
    const db = getDb();
    return db ? collection(db, "categories") : null;
  }, []);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (mounted) {
        setLoading(true);
        setError(null);
      }

      try {
        if (!categoriesCol) {
          throw new Error(
            "Firebase is not configured. Create `.env.local` with NEXT_PUBLIC_FIREBASE_* values.",
          );
        }
        const q = query(categoriesCol, orderBy("name", "asc"));
        const snap = await getDocs(q);
        const rows: CategoryDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Record<string, unknown>),
        }));
        if (!mounted) return;
        setCategories(rows);
      } catch (e) {
        if (!mounted) return;
        setError(
          e instanceof Error
            ? e.message
            : "Failed to load categories from Firestore",
        );
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [categoriesCol]);

  if (error) {
    return (
      <div className="mt-6 rounded-2xl border bg-card p-6">
        <div className="text-sm font-medium">Couldn’t load categories</div>
        <div className="mt-2 text-sm text-muted-foreground">{error}</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div
            key={idx}
            className="h-32 animate-pulse rounded-2xl border bg-card"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {categories.map((c) => {
        const name = getCategoryName(c);
        const img = getCategoryImage(c);
        const href = getCategoryPath(c);

        return (
          <Link
            key={c.id}
            href={href}
            className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="relative aspect-[16/10] w-full bg-muted">
              {img ? (
                <Image
                  alt={name}
                  src={img}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
                  No image
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="truncate text-sm font-semibold">{name}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                View services
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

