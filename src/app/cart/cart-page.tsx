"use client";

import Link from "next/link";
import { RemoteImage as Image } from "@/components/remote-image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Loader2, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Container } from "@/components/container";
import { useCart } from "@/context/cart-context";
import {
  cartSubtotal,
  cartTotal,
  cartVisitingCharge,
} from "@/lib/cart/storage";
import { getBookPath } from "@/lib/catalog/slug";
import { SectionPromoBanner } from "@/components/home/promo-banner";
import { useAuth } from "@/hooks/use-auth";
import { getDb } from "@/lib/firebase/firestore";
import {
  calculateDiscount,
  validateCoupon,
  type CouponResult,
} from "@/lib/coupons/validate";

export default function CartPageClient() {
  const router = useRouter();
  const { items, updateQuantity, removeItem, clearCart } = useCart();
  const { user } = useAuth();
  const db = useMemo(() => getDb(), []);

  const [promoCode, setPromoCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponResult | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

  const subtotal = useMemo(() => cartSubtotal(items), [items]);
  const visiting = useMemo(() => cartVisitingCharge(items), [items]);
  const orderSubtotal = subtotal + visiting;
  const discountAmount = useMemo(
    () => calculateDiscount(orderSubtotal, appliedCoupon),
    [orderSubtotal, appliedCoupon],
  );
  const total = Math.max(0, cartTotal(items) - discountAmount);

  const applyPromo = async () => {
    if (!db) {
      setPromoError("Firebase is not configured.");
      return;
    }
    setPromoLoading(true);
    setPromoError("");
    try {
      const result = await validateCoupon(db, promoCode, orderSubtotal);
      if (!result.valid) {
        setAppliedCoupon(null);
        setPromoError(result.message);
        return;
      }
      setAppliedCoupon(result);
      try {
        sessionStorage.setItem(
          "rs_cart_promo",
          JSON.stringify({ code: result.code, at: Date.now() }),
        );
      } catch {
        /* optional */
      }
    } catch (e) {
      setAppliedCoupon(null);
      setPromoError(e instanceof Error ? e.message : "Could not apply promo.");
    } finally {
      setPromoLoading(false);
    }
  };

  const checkout = () => {
    if (items.length === 0) return;
    if (!user) {
      router.push("/auth?return=/cart/checkout");
      return;
    }
    router.push("/cart/checkout");
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-[#F8F6F4] py-4 md:bg-transparent md:py-10">
      <Container className="max-w-4xl">
        <div className="md:hidden">
          <h1 className="text-2xl font-extrabold text-[#1A1A1A]">
            Service <span className="text-[#C45508]">Cart</span>
          </h1>
          <p className="mt-1 text-sm text-[#6B6B6B]">
            Review your selected services before booking.
          </p>
        </div>
        <h1 className="hidden text-3xl font-bold text-[#0a0f1c] md:block">Your Cart</h1>
        <p className="mt-2 hidden text-sm text-[#64748b] md:block">
          Review services before booking. Book Now remains the fastest way to schedule a visit.
        </p>

        <div className="-mx-4 mt-3 md:mx-0">
          <SectionPromoBanner section="cart" />
        </div>

        {items.length === 0 ? (
          <div className="mt-12 flex flex-col items-center rounded-[24px] border border-dashed border-gray-200 bg-gray-50 py-16 text-center">
            <ShoppingBag className="mb-4 size-12 text-gray-300" />
            <h2 className="text-lg font-bold text-[#0a0f1c]">Your cart is empty</h2>
            <p className="mt-1 text-sm text-[#64748b]">Browse services and add what you need.</p>
            <Link
              href="/services"
              className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-[#f96316] px-8 text-sm font-bold text-white"
            >
              Book Now — Browse Services
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.lineId}
                  className="flex gap-4 rounded-[20px] border border-black/5 bg-white p-4 shadow-sm"
                >
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-[#0a0f1c]">{item.name}</h3>
                    <p className="mt-1 text-sm font-semibold text-[#f96316]">
                      ₹{item.price.toLocaleString("en-IN")} each
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <div className="inline-flex items-center rounded-full border border-gray-200">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
                          className="flex size-8 items-center justify-center text-[#64748b] hover:text-[#0a0f1c]"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="min-w-8 text-center text-sm font-bold">{item.quantity}</span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                          className="flex size-8 items-center justify-center text-[#64748b] hover:text-[#0a0f1c]"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.lineId)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"
                      >
                        <Trash2 className="size-3.5" />
                        Remove
                      </button>
                      <Link
                        href={getBookPath({ id: item.serviceId, slug: item.slug })}
                        className="ml-auto text-xs font-bold text-[#f96316] hover:underline"
                      >
                        Book Now
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={clearCart}
                className="text-sm font-medium text-[#64748b] hover:text-red-600"
              >
                Clear cart
              </button>
            </div>

            <aside className="h-fit rounded-[20px] border border-black/5 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-[#0a0f1c]">Price Breakdown</h2>
              <div className="mt-4 flex gap-2">
                <input
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="Promo code"
                  className="h-10 flex-1 rounded-full border px-3 text-sm"
                />
                <button
                  type="button"
                  disabled={promoLoading}
                  onClick={() => void applyPromo()}
                  className="inline-flex h-10 items-center rounded-full border px-4 text-xs font-bold"
                >
                  {promoLoading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    "Apply"
                  )}
                </button>
              </div>
              {promoError ? (
                <p className="mt-2 text-xs text-red-600">{promoError}</p>
              ) : null}
              {appliedCoupon?.valid ? (
                <p className="mt-2 text-xs text-green-700">{appliedCoupon.message}</p>
              ) : null}
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[#64748b]">Subtotal</dt>
                  <dd className="font-semibold">₹{subtotal.toLocaleString("en-IN")}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#64748b]">Visiting Charge</dt>
                  <dd className="font-semibold">₹{visiting.toLocaleString("en-IN")}</dd>
                </div>
                {discountAmount > 0 ? (
                  <div className="flex justify-between text-green-700">
                    <dt>Promo discount</dt>
                    <dd className="font-semibold">
                      -₹{discountAmount.toLocaleString("en-IN")}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-gray-100 pt-3 text-base">
                  <dt className="font-bold text-[#0a0f1c]">Total Amount</dt>
                  <dd className="font-bold text-[#f96316]">₹{total.toLocaleString("en-IN")}</dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={checkout}
                className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-[#f96316] text-sm font-bold text-white shadow-md transition hover:bg-[#ea580c]"
              >
                Proceed to Checkout
              </button>
              <p className="mt-3 text-center text-xs text-[#64748b]">
                Multi-service cart books together when one partner covers all categories; otherwise we split by category.
              </p>
            </aside>
          </div>
        )}
      </Container>
    </div>
  );
}
