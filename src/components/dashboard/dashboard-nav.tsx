"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BookOpen,
  LogOut,
  MapPin,
  Menu,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { logOut } from "@/lib/firebase/auth-actions";

const NAV = [
  { href: "/dashboard/profile", label: "My Profile", icon: User },
  { href: "/dashboard/bookings", label: "My Bookings", icon: BookOpen },
  { href: "/dashboard/addresses", label: "Saved Addresses", icon: MapPin },
  { href: "/delete-account", label: "Delete Account", icon: Trash2 },
] as const;

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { customer } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const onLogout = async () => {
    setLoggingOut(true);
    try {
      await logOut();
      router.replace("/");
    } catch {
      setLoggingOut(false);
    }
  };

  const navContent = (
    <>
      <div className="mb-6 px-1">
        <div className="text-lg font-bold text-[#0a0f1c]">My Dashboard</div>
        {customer?.name ? (
          <div className="mt-1 truncate text-sm text-[#64748b]">{customer.name}</div>
        ) : null}
      </div>

      <nav className="space-y-1">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={[
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all",
                active
                  ? item.href === "/delete-account"
                    ? "bg-red-50 text-red-700"
                    : "bg-[#f96316] text-white shadow-sm"
                  : item.href === "/delete-account"
                    ? "text-red-600 hover:bg-red-50"
                    : "text-[#64748b] hover:bg-orange-50 hover:text-[#0a0f1c]",
              ].join(" ")}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 border-t border-gray-100 pt-4">
        <Button
          variant="outline"
          size="lg"
          className="w-full justify-start gap-3 rounded-xl"
          disabled={loggingOut}
          onClick={onLogout}
        >
          <LogOut className="size-4" />
          {loggingOut ? "Logging out..." : "Logout"}
        </Button>
      </div>
    </>
  );

  return (
    <>
      <button
        type="button"
        className="mb-4 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium lg:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="size-4" />
        Menu
      </button>

      <aside className="hidden w-[260px] shrink-0 lg:block">
        <div className="sticky top-24 rounded-[20px] border border-black/5 bg-white/90 p-5 shadow-sm backdrop-blur-sm">
          {navContent}
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-[min(100%,300px)] bg-white p-5 shadow-xl">
            <button
              type="button"
              className="mb-4 inline-flex size-10 items-center justify-center rounded-full border"
              onClick={() => setMobileOpen(false)}
            >
              <X className="size-4" />
            </button>
            {navContent}
          </div>
        </div>
      ) : null}
    </>
  );
}
