import type { Metadata } from "next";
import CartPageClient from "./cart-page";

export const metadata: Metadata = {
  title: "Cart",
  description: "Review your selected services and proceed to checkout.",
  alternates: { canonical: "https://www.repairseries.in/cart" },
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return <CartPageClient />;
}

