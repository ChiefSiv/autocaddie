"use client";

import { useEffect } from "react";

/**
 * Warm the current route's DOCUMENT into the service-worker runtime cache while
 * online, so an OFFLINE reload of this route is served from cache (and the client
 * rehydrates from IndexedDB) instead of dropping to the /offline fallback.
 *
 * Why this is needed: dynamic app routes (e.g. /play/[eventId]/score) are reached
 * by client-side navigation, so their HTML document is never fetched — nothing for
 * the SW's NetworkFirst page cache to store. On an offline reload the navigation
 * misses cache and Serwist serves /offline. Re-fetching location.href here forces
 * one real document fetch the SW can cache. (The /offline fallback then only fires
 * for routes that genuinely have nothing cached and nothing local to rehydrate.)
 *
 * No-op without a service worker (e.g. dev, where the SW is disabled) or offline.
 */
export function useWarmRouteCache(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let warmed = false;
    const warm = () => {
      if (warmed || !navigator.onLine) return;
      warmed = true;
      fetch(window.location.href, { cache: "reload", credentials: "include" }).catch(
        () => {
          warmed = false; // let a later 'online' event retry
        },
      );
    };

    navigator.serviceWorker.ready.then(warm).catch(() => {});
    window.addEventListener("online", warm);
    return () => window.removeEventListener("online", warm);
  }, []);
}
