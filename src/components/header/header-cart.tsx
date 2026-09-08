"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/context/cart-context";

export function HeaderCartButton() {
  const { itemCount } = useCart();

  return (
    <Link
      href="/cart"
      aria-label={`Cart, ${itemCount} items`}
      className="relative flex size-11 items-center justify-center rounded-full border border-gray-200 bg-white text-black transition-colors hover:bg-gray-50"
    >
      <ShoppingCart className="size-5" />
      {itemCount > 0 ? (
        <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#f96316] px-1 text-[10px] font-bold text-white animate-in zoom-in duration-200">
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      ) : null}
    </Link>
  );
}
