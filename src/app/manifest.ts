import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest. theme-color uses Chalk (light app bg);
// the OS-dark variant is handled by the <meta name="theme-color"> media tags
// emitted from `viewport` in layout.tsx.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Autocaddie — Golf Games",
    short_name: "Autocaddie",
    description:
      "Play golf games with friends. Handicap-fair scoring, live tracking, one combined settle-up.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B1410",
    theme_color: "#F6F7F3",
    categories: ["sports", "lifestyle"],
    icons: [
      { src: "/icons/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { src: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
      {
        src: "/icons/icon-maskable-512.png",
        type: "image/png",
        sizes: "512x512",
        purpose: "maskable",
      },
    ],
  };
}
