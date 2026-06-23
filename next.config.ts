import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

// Serwist's plugin is webpack-based (`npm run build` uses `next build --webpack`).
// In dev the SW is disabled, so Turbopack dev is fine — silence the notice.
process.env.SERWIST_SUPPRESS_TURBOPACK_WARNING = "1";

const nextConfig: NextConfig = {
  /* config options here */
};

// Serwist compiles src/app/sw.ts -> public/sw.js and injects the precache
// manifest. Disabled in dev so HMR isn't fighting a service worker.
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(nextConfig);
