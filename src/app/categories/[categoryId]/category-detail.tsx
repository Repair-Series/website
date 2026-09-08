"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CategoryServices } from "@/app/categories/[categoryId]/category-services";
import { getDb } from "@/lib/firebase/firestore";
import { resolveCategoryByPath } from "@/lib/catalog/resolve";
import { 
  AlertCircle, 
  ArrowLeft, 
  CalendarDays, 
  ImageOff, 
  SearchX 
} from "lucide-react";
import { PromoBannerSection } from "@/components/home/promo-banner";
import { CategoryVideo } from "@/components/category-video";
import { resolveBannerSectionsForCategory } from "@/lib/banners/sections";

type CategoryDoc = {
  id: string;
  name?: string;
  title?: string;
  image?: string;
  icon?: string;
  slug?: string;
  description?: string;
  videoUrl?: string;
  videoEnabled?: boolean;
};

function getCategoryName(c: CategoryDoc) {
  return c.name ?? c.title ?? "Category";
}

function getCategoryImage(c: CategoryDoc) {
  return c.icon ?? c.image ?? null;
}

export function CategoryDetail({
  categoryIdOrSlug,
}: {
  categoryIdOrSlug: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryDoc | null>(null);

  const db = useMemo(() => getDb(), []);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (mounted) {
        setLoading(true);
        setError(null);
        setCategory(null);
      }

      try {
        if (!db) {
          throw new Error(
            "Firebase is not configured. Create `.env.local` with NEXT_PUBLIC_FIREBASE_* values.",
          );
        }
        const row = await resolveCategoryByPath(db, categoryIdOrSlug);
        if (mounted) setCategory(row);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Failed to load category");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [categoryIdOrSlug, db]);

  // Premium Error State
  if (error) {
    return (
      <div className="mx-auto mt-8 flex max-w-3xl items-start gap-4 rounded-2xl border border-red-100 bg-red-50 p-6 text-red-900 shadow-sm">
        <AlertCircle className="mt-0.5 size-6 shrink-0 text-red-500" />
        <div>
          <h3 className="text-base font-bold">Couldn’t load category</h3>
          <p className="mt-1 text-sm leading-relaxed text-red-700/90">{error}</p>
          <Link href="/categories" className="mt-4 inline-flex items-center text-sm font-bold text-red-600 hover:underline">
            <ArrowLeft className="mr-1.5 size-4" /> Back to categories
          </Link>
        </div>
      </div>
    );
  }

  // Premium Loading Skeletons
  if (loading) {
    return (
      <div className="flex flex-col overflow-hidden rounded-[20px] border border-gray-100 bg-white shadow-sm">
        <div className="aspect-[21/9] w-full animate-pulse bg-gray-200 md:aspect-[25/9]" />
        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="w-full max-w-2xl">
              <div className="mb-4 h-10 w-2/3 animate-pulse rounded-md bg-gray-200" />
              <div className="space-y-3">
                <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
                <div className="h-4 w-4/5 animate-pulse rounded bg-gray-100" />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="h-12 w-24 animate-pulse rounded-full bg-gray-100" />
              <div className="h-12 w-32 animate-pulse rounded-full bg-gray-200" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Premium Not Found State
  if (!category) {
    return (
      <div className="mx-auto mt-8 flex max-w-2xl flex-col items-center justify-center rounded-[20px] border border-dashed border-gray-200 bg-gray-50 py-16 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-gray-100">
          <SearchX className="size-7 text-gray-400" />
        </div>
        <h3 className="text-xl font-bold text-[#0a0f1c]">Category not found</h3>
        <p className="mt-2 max-w-md text-sm text-[#64748b]">
          The category might be unavailable, or your Firestore security rules don’t allow reads for this page.
        </p>
        <Link 
          href="/categories" 
          className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[#0a0f1c] px-6 text-sm font-medium text-white transition-colors hover:bg-[#162032]"
        >
          <ArrowLeft className="mr-2 size-4" /> Back to categories
        </Link>
      </div>
    );
  }

  const name = getCategoryName(category);
  const img = getCategoryImage(category);
  const bannerSections = resolveBannerSectionsForCategory(category, ["category"]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="-mx-4 mb-2 md:mx-0">
        <PromoBannerSection section={bannerSections} />
      </div>
      <CategoryVideo category={category} />
      
      {/* Premium Hero Banner */}
      <div className="mb-12 overflow-hidden rounded-[20px] border border-black/5 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.02)]">
        
        {/* Banner Image with Overlay */}
        <div className="group relative aspect-[21/9] w-full overflow-hidden bg-gray-100 md:aspect-[25/9]">
          {img ? (
            <>
              <img 
                alt={name} 
                src={img} 
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" 
              />
              {/* Subtle dark gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent opacity-80" />
            </>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center text-[#94a3b8]">
              <ImageOff className="mb-2 size-10 opacity-50" />
              <span className="text-sm font-medium uppercase tracking-wider opacity-70">No cover image</span>
            </div>
          )}
          
          {/* Overlay Title (Visible only on larger screens for visual impact) */}
          {img && (
            <div className="absolute bottom-6 left-8 hidden md:block">
              <h1 className="text-4xl font-extrabold tracking-tight text-white drop-shadow-md">
                {name}
              </h1>
            </div>
          )}
        </div>

        {/* Banner Content */}
        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-3xl">
              {/* Title (Always visible on mobile, hidden on desktop if overlay is active) */}
              <h1 className={`text-3xl font-bold tracking-tight text-[#0a0f1c] ${img ? 'md:hidden' : ''}`}>
                {name}
              </h1>
              <p className="mt-3 text-[1.05rem] leading-relaxed text-[#64748b]">
                {category.description ?? "Browse our premium services under this category and book a verified professional instantly."}
              </p>
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                href="/categories"
                className="inline-flex h-12 items-center justify-center rounded-full border border-gray-200 bg-white px-6 text-sm font-bold text-[#0a0f1c] transition-colors hover:bg-gray-50"
              >
                <ArrowLeft className="mr-2 size-4" /> Back
              </Link>
              <Link
                href="/dashboard/bookings"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#f96316] px-6 text-sm font-bold text-white shadow-[0_8px_20px_rgba(249,99,22,0.25)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#ea580c] hover:shadow-[0_10px_25px_rgba(249,99,22,0.35)]"
              >
                <CalendarDays className="size-4" />
                My Bookings
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Services Grid (Child Component) */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#0a0f1c]">Available Services</h2>
        <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#f96316]">
          {name}
        </span>
      </div>
      
      <CategoryServices categoryId={category.id} />
      
    </div>
  );
}