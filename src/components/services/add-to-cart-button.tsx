"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import type { ServiceDoc } from "@/lib/booking/types";
import { useCart } from "@/context/cart-context";
import { getServicePath } from "@/lib/catalog/slug";
import {
  getActiveVariations,
  serviceHasVariations,
} from "@/lib/services/pricing";

type AddToCartButtonProps = {
  service: ServiceDoc;
  variationId?: string | null;
  className?: string;
  size?: "sm" | "md";
};

export function AddToCartButton({
  service,
  variationId,
  className = "",
  size = "md",
}: AddToCartButtonProps) {
  const router = useRouter();
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");

  const hasVar = serviceHasVariations(service);
  const variations = getActiveVariations(service);

  const onAdd = () => {
    setError("");
    if (hasVar) {
      const vid = variationId ?? variations[0]?.id;
      const v = variations.find((x) => x.id === vid);
      if (!v) {
        router.push(getServicePath(service));
        return;
      }
      try {
        addItem(service, 1, {
          id: v.id,
          title: v.title,
          price: v.price,
          imageUrl: v.imageUrl || v.image || undefined,
        });
        setAdded(true);
        setTimeout(() => setAdded(false), 2000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not add to cart");
      }
      return;
    }
    try {
      addItem(service, 1);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add to cart");
    }
  };

  const sizeClass =
    size === "sm"
      ? "h-9 px-3 text-xs"
      : "h-10 px-4 text-sm";

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onAdd}
        className={`inline-flex items-center justify-center gap-1.5 rounded-full border border-gray-200 bg-white font-semibold text-[#64748b] transition hover:border-[#f96316]/40 hover:text-[#f96316] ${sizeClass} ${className}`}
      >
        <ShoppingCart className="size-3.5" />
        {added ? "Added" : "Add to Cart"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
