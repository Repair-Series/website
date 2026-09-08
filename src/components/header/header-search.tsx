"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useRotatingSearchPlaceholder } from "@/lib/search/use-rotating-placeholder";
import { useCatalog } from "@/context/catalog-context";
import { searchCatalog } from "@/lib/search/catalog-search";
import { getCategoryPath, getServicePath } from "@/lib/catalog/slug";

export function HeaderSearch() {
  const router = useRouter();
  const { services, categories } = useCatalog();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rotatingPlaceholder = useRotatingSearchPlaceholder(
    focused || query.trim().length > 0,
  );

  const results = useMemo(
    () => searchCatalog(query, services, categories, 6),
    [query, services, categories],
  );

  const hasQuery = query.trim().length > 0;
  const empty = hasQuery && results.services.length === 0 && results.categories.length === 0;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const goSearchPage = useCallback(() => {
    const q = query.trim();
    if (!q) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }, [query, router]);

  return (
    <div ref={wrapRef} className="relative flex h-12 flex-1 items-center gap-3 rounded-md border border-gray-200 bg-white px-4 focus-within:border-gray-400 hover:border-gray-300">
      <Search className="size-5 shrink-0 text-gray-400" />
      <input
        type="text"
        placeholder={
          focused || query.trim()
            ? "Search services..."
            : rotatingPlaceholder || "Search for AC service"
        }
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            goSearchPage();
          }
        }}
        className="w-full bg-transparent text-[15px] text-black outline-none placeholder:text-gray-400"
        aria-label="Search services"
        autoComplete="off"
      />

      {open && (hasQuery || results.services.length > 0) ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[100] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl animate-in fade-in slide-in-from-top-1 duration-200">
          {empty ? (
            <div className="px-4 py-6 text-center text-sm text-[#64748b]">No services found</div>
          ) : (
            <ul className="max-h-[320px] overflow-y-auto py-2">
              {results.services.map((s) => (
                <li key={s.id}>
                  <Link
                    href={getServicePath(s)}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-orange-50"
                  >
                    <span className="truncate font-medium text-[#0a0f1c]">
                      {s.name ?? s.title}
                    </span>
                    <span className="text-xs text-[#f96316]">Service</span>
                  </Link>
                </li>
              ))}
              {results.categories.map((c) => (
                <li key={c.id}>
                  <Link
                    href={getCategoryPath(c)}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-orange-50"
                  >
                    <span className="truncate font-medium text-[#0a0f1c]">
                      {c.name ?? c.title}
                    </span>
                    <span className="text-xs text-[#64748b]">Category</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {hasQuery ? (
            <button
              type="button"
              onClick={goSearchPage}
              className="w-full border-t border-gray-100 px-4 py-3 text-left text-sm font-semibold text-[#f96316] hover:bg-orange-50"
            >
              See all results for &ldquo;{query.trim()}&rdquo;
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
