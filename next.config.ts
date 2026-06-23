import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

// Serwist's plugin is webpack-based (`npm run build` uses `next build --webpack`).
// In dev the SW is disabled, so Turbopack dev is fine — silence the notice.
process.env.SERWIST_SUPPRESS_TURBOPACK_WARNING = "1";

const nextConfig: NextConfig = {
  // `@serwist/next` injects a webpack config even when disabled. Next 16 dev
  // defaults to Turbopack and errors on "webpack config + no turbopack config".
  // An empty turbopack config is Next's own sanctioned silencer, so dev runs
  // cleanly on Turbopack (SW is disabled in dev) while the prod build uses
  // `next build --webpack` for Serwist's webpack-based SW compilation.
  turbopack: {},
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
