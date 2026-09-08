"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Home,
  Search,
  UserRound,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const TABS = [
  { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  {
    href: "/dashboard/bookings",
    label: "Bookings",
    icon: CalendarDays,
    match: (p: string) => p.startsWith("/dashboard/bookings"),
  },
  {
    href: "/services",
    label: "Services",
    icon: Wrench,
    match: (p: string) =>
      p.startsWith("/services") ||
      p.startsWith("/categories") ||
      p.startsWith("/category") ||
      p.startsWith("/search") ||
      p.startsWith("/coming-soon"),
  },
  {
    href: "/dashboard",
    label: "Account",
    icon: UserRound,
    match: (p: string) =>
      p.startsWith("/dashboard") && !p.startsWith("/dashboard/bookings"),
  },
] as const;

/**
 * App-like bottom navigation — visible on phone widths only.
 */
export function MobileBottomNav() {
  const pathname = usePathname() || "/";
  const { user } = useAuth();

  const hide =
    pathname.startsWith("/auth") ||
    pathname.startsWith("/book") ||
    pathname.startsWith("/cart");

  if (hide) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-[#E8E4E0] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label="App navigation"
    >
      <div className="mx-auto grid h-[64px] max-w-lg grid-cols-4">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const href =
            tab.href.startsWith("/dashboard") && !user ? "/auth" : tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={href}
              className={`flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors ${
                active ? "text-[#C45508]" : "text-[#8A8F98]"
              }`}
            >
              <Icon className={`size-5 ${active ? "stroke-[2.5]" : ""}`} />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function MobileAppHeaderActions() {
  return (
    <Link
      href="/search"
      className="flex size-10 items-center justify-center rounded-full bg-[#FDE7DD] text-[#C45508] md:hidden"
      aria-label="Search services"
    >
      <Search className="size-5" />
    </Link>
  );
}
