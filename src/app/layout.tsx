import type { Metadata, Viewport } from "next";
import { Saira_Condensed, Saira, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/providers";
import { BottomNav } from "@/components/nav/bottom-nav";
import { THEME_INIT_SCRIPT } from "@/components/theme/theme-script";
import { SW_DEV_CLEANUP_SCRIPT } from "@/components/dev/sw-dev-cleanup";
import { cn } from "@/lib/utils";

const isDev = process.env.NODE_ENV !== "production";

// §4 type roles — exposed as CSS vars consumed by the Tailwind theme.
const sairaCondensed = Saira_Condensed({
  variable: "--font-saira-condensed",
  weight: ["500", "600", "700", "800"],
  subsets: ["latin"],
  display: "swap",
});
const saira = Saira({
  variable: "--font-saira",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Autocaddie — Keep score. Settle up.",
  description:
    "Play golf games against your friends. Handicap-fair net scoring, live tracking, and one combined settle-up. Social scorekeeping with optional stakes.",
  applicationName: "Autocaddie",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Autocaddie",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

// theme-color follows the manifest: Chalk in light, Ink in dark.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F7F3" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1410" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full antialiased",
        sairaCondensed.variable,
        saira.variable,
        hanken.variable,
      )}
    >
      <body className="min-h-full">
        {/* Apply saved/OS theme before paint to avoid a flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* DEV ONLY: tear down any stale prod service worker poisoning dev. */}
        {isDev && (
          <script dangerouslySetInnerHTML={{ __html: SW_DEV_CLEANUP_SCRIPT }} />
        )}
        <Providers>
          {/* Mobile-first: content centered in a max-width column on larger screens. */}
          <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col px-4 pb-24">
            {children}
          </div>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
