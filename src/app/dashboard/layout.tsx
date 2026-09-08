"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Container } from "@/components/container";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { useAuth } from "@/hooks/use-auth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, isBlocked } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <Container className="py-12">
        <div className="h-64 animate-pulse rounded-[24px] bg-muted/50" />
      </Container>
    );
  }

  if (!user) return null;

  if (isBlocked) {
    return (
      <Container className="py-12">
        <div className="mx-auto max-w-lg rounded-[24px] border border-red-200 bg-red-50 p-8 text-center">
          <h1 className="text-xl font-bold text-red-900">Account blocked</h1>
          <p className="mt-3 text-sm text-red-700">
            Your account has been temporarily blocked. Please contact support.
          </p>
          <Link
            href="/contact"
            className="mt-6 inline-block text-sm font-semibold text-[#f96316] underline"
          >
            Contact support
          </Link>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-10">
      <div className="flex flex-col gap-8 lg:flex-row">
        <DashboardNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </Container>
  );
}
