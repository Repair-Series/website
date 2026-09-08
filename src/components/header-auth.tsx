"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { User } from "lucide-react";

export function HeaderAuth() {
  const { user, loading } = useAuth();

  // Loading skeleton matching the circular shape
  if (loading) {
    return <div className="size-11 animate-pulse rounded-full border border-gray-200 bg-gray-100" />;
  }

  // Same circular icon regardless of auth state, just changes destination
  // You can customize this if you want a dropdown when logged in
  return (
    <Link
      href={user ? "/dashboard" : "/auth"}
      aria-label={user ? "Profile" : "Sign in"}
      className="flex size-11 items-center justify-center rounded-full border border-gray-200 bg-white text-black transition-colors hover:bg-gray-50"
    >
      <User className="size-5" />
    </Link>
  );
}