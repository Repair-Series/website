"use client";

import type { ReactNode } from "react";
import { CartProvider } from "@/context/cart-context";
import { CatalogProvider } from "@/context/catalog-context";
import { GuestBrowseProvider } from "@/context/guest-browse-context";
import { LocationProvider } from "@/context/location-context";

import { AppSettingsProvider } from "@/context/app-settings-context";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppSettingsProvider>
    <LocationProvider>
      <CatalogProvider>
        <CartProvider>
          <GuestBrowseProvider>{children}</GuestBrowseProvider>
        </CartProvider>
      </CatalogProvider>
    </LocationProvider>
    </AppSettingsProvider>
  );
}
