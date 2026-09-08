"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ServiceDoc } from "@/lib/booking/types";
import {
  cartItemCount,
  cartItemFromService,
  loadCartFromStorage,
  saveCartToStorage,
  type CartItem,
} from "@/lib/cart/storage";
import { serviceHasVariations } from "@/lib/services/pricing";

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  addItem: (
    service: ServiceDoc,
    quantity?: number,
    variation?: { id: string; title: string; price: number; imageUrl?: string },
  ) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeItem: (lineId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(loadCartFromStorage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveCartToStorage(items);
  }, [items, hydrated]);

  const addItem = useCallback(
    (
      service: ServiceDoc,
      quantity = 1,
      variation?: { id: string; title: string; price: number; imageUrl?: string },
    ) => {
      if (serviceHasVariations(service) && !variation) {
        throw new Error("Please select a service option before adding to cart.");
      }
      const incoming = cartItemFromService(service, quantity, variation);
      setItems((prev) => {
        const idx = prev.findIndex((p) => p.lineId === incoming.lineId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            quantity: next[idx].quantity + quantity,
          };
          return next;
        }
        return [...prev, incoming];
      });
    },
    [],
  );

  const updateQuantity = useCallback((lineId: string, quantity: number) => {
    const q = Math.round(quantity);
    if (q <= 0) {
      setItems((prev) => prev.filter((i) => i.lineId !== lineId));
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.lineId === lineId ? { ...i, quantity: q } : i)),
    );
  }, []);

  const removeItem = useCallback((lineId: string) => {
    setItems((prev) => prev.filter((i) => i.lineId !== lineId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({
      items,
      itemCount: cartItemCount(items),
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
    }),
    [items, addItem, updateQuantity, removeItem, clearCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
