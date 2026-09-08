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
import { useAuth } from "@/hooks/use-auth";

const GUEST_BROWSE_KEY = "repair_series_guest_browse_v1";

type GuestBrowseContextValue = {
  ready: boolean;
  isGuestBrowse: boolean;
  enterGuestBrowse: () => void;
  /** Pure href — safe to call during render (no setState). */
  getLoginHref: (returnPath?: string) => string;
  /** Clear guest mode (call from click/effect, never during render). */
  endGuestBrowse: () => void;
  /**
   * End guest mode and return login href.
   * Only call from event handlers — not during render.
   */
  promptLogin: (returnPath?: string) => string;
};

const GuestBrowseContext = createContext<GuestBrowseContextValue | null>(null);

export function GuestBrowseProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);
  const [isGuestBrowse, setIsGuestBrowse] = useState(false);

  useEffect(() => {
    try {
      setIsGuestBrowse(localStorage.getItem(GUEST_BROWSE_KEY) === "1");
    } catch {
      setIsGuestBrowse(false);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    setIsGuestBrowse(false);
    try {
      localStorage.removeItem(GUEST_BROWSE_KEY);
    } catch {
      /* ignore */
    }
  }, [user]);

  const enterGuestBrowse = useCallback(() => {
    try {
      localStorage.setItem(GUEST_BROWSE_KEY, "1");
    } catch {
      /* ignore */
    }
    setIsGuestBrowse(true);
  }, []);

  const getLoginHref = useCallback((returnPath?: string) => {
    const ret = returnPath?.trim() || "/";
    return `/auth?return=${encodeURIComponent(ret)}`;
  }, []);

  const endGuestBrowse = useCallback(() => {
    setIsGuestBrowse(false);
    try {
      localStorage.removeItem(GUEST_BROWSE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const promptLogin = useCallback(
    (returnPath?: string) => {
      endGuestBrowse();
      return getLoginHref(returnPath);
    },
    [endGuestBrowse, getLoginHref],
  );

  const value = useMemo(
    () => ({
      ready,
      isGuestBrowse,
      enterGuestBrowse,
      getLoginHref,
      endGuestBrowse,
      promptLogin,
    }),
    [ready, isGuestBrowse, enterGuestBrowse, getLoginHref, endGuestBrowse, promptLogin],
  );

  return (
    <GuestBrowseContext.Provider value={value}>
      {children}
    </GuestBrowseContext.Provider>
  );
}

export function useGuestBrowse(): GuestBrowseContextValue {
  const ctx = useContext(GuestBrowseContext);
  if (!ctx) {
    throw new Error("useGuestBrowse must be used within GuestBrowseProvider");
  }
  return ctx;
}
