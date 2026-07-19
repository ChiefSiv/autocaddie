"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

// In-app navigation for the round sub-routes. Installed as a PWA there is no
// browser back chrome, so without this the sub-routes are dead ends. Back → round
// home; the tabs move between Enter/Card/Recap/Settle. "Settle" here is also the
// END-EARLY path — reachable mid-round without finishing 18.

type RoundTab = "score" | "card" | "recap" | "settle";

const TABS: { key: RoundTab; label: string; seg: string }[] = [
  { key: "score", label: "Enter", seg: "score" },
  { key: "card", label: "Card", seg: "card" },
  { key: "recap", label: "Recap", seg: "recap" },
  { key: "settle", label: "Settle", seg: "settle" },
];

export function RoundSubnav({
  eventId,
  active,
}: {
  eventId: string;
  active: RoundTab;
}) {
  return (
    <nav aria-label="Round" className="mb-3 flex items-center gap-2 pt-1">
      <Link
        href={`/play/${eventId}`}
        className="font-label flex flex-none items-center gap-1 rounded-lg border border-line bg-card px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted shadow-card"
      >
        <ChevronLeft className="size-4" /> Round
      </Link>
      <div className="flex flex-1 gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/play/${eventId}/${t.seg}`}
            aria-current={t.key === active ? "page" : undefined}
            className={`font-label flex-none rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.05em] ${
              t.key === active
                ? "bg-ink text-white"
                : "border border-line bg-card text-muted"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
