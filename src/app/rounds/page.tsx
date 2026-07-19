"use client";

import Link from "next/link";
import { ChevronRight, Flag } from "lucide-react";
import { AppHeader } from "@/components/nav/app-header";
import { AuthGate } from "@/components/auth/auth-gate";
import { SectionHeader } from "@/components/ui/section";
import { EmptyState } from "@/components/ui/empty-state";
import { useMyRounds, type MyRound } from "@/lib/queries/events";

// Read-only round history (Phase 2.x): list the user's rounds over data that
// already persists. No editing/deletion, no standings/analytics — a list + a
// link (the §3 deferred-verbs list still holds). Reuses Home's card language.

const STATUS: Record<string, { label: string; className: string }> = {
  setup: { label: "Setup", className: "text-muted" },
  active: { label: "In progress", className: "text-flare" },
  completed: { label: "Final", className: "text-fairway" },
  archived: { label: "Archived", className: "text-muted" },
};

const fmtNet = (n: number) => `${n >= 0 ? "+" : "−"}$${Math.abs(n)}`;

function inProgress(status: string) {
  return status === "active" || status === "setup";
}

function RoundRow({ r }: { r: MyRound }) {
  const st = STATUS[r.status] ?? { label: r.status, className: "text-muted" };
  // In-progress → score entry; completed → recap (reads best as a landing view).
  const href = inProgress(r.status)
    ? `/play/${r.id}/score`
    : `/play/${r.id}/recap`;
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg border border-line bg-card p-4 shadow-card"
    >
      <div className="min-w-0">
        <div className="font-display truncate text-lg font-extrabold uppercase">
          {r.courseName ?? "Round"}
        </div>
        <div className="mt-0.5 truncate text-xs text-muted">
          {r.date ?? "—"} · {r.holesToPlay} holes
          {r.whichNine ? ` (${r.whichNine})` : ""}
          {r.crewName ? ` · ${r.crewName}` : " · one-off"}
        </div>
        <div className={`font-label mt-1 text-[10px] uppercase tracking-[0.08em] ${st.className}`}>
          {st.label}
        </div>
      </div>
      <div className="flex flex-none items-center gap-3">
        {r.myNet != null && (
          <span
            className={`font-display text-xl font-extrabold tabular-nums ${
              r.myNet > 0 ? "text-up" : r.myNet < 0 ? "text-down" : "text-muted"
            }`}
          >
            {r.myNet === 0 ? "$0" : fmtNet(r.myNet)}
          </span>
        )}
        <ChevronRight className="size-5 text-muted" aria-hidden />
      </div>
    </Link>
  );
}

function RoundsContent() {
  const { data: rounds, isLoading } = useMyRounds();

  return (
    <main className="flex flex-1 flex-col py-5">
      <div className="mb-4">
        <p className="eyebrow">History</p>
        <h1 className="font-display mt-0.5 text-3xl font-extrabold uppercase leading-none">
          Rounds
        </h1>
      </div>

      <SectionHeader title="Your rounds" />
      {isLoading ? (
        <div className="flex flex-col gap-2.5">
          <div className="h-20 animate-pulse rounded-lg bg-field" aria-hidden />
          <div className="h-20 animate-pulse rounded-lg bg-field" aria-hidden />
        </div>
      ) : rounds && rounds.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {rounds.map((r) => (
            <RoundRow key={r.id} r={r} />
          ))}
        </div>
      ) : (
        <EmptyState icon={<Flag className="size-6" aria-hidden />}>
          No rounds yet — start your first and it&rsquo;ll show up here.
        </EmptyState>
      )}
    </main>
  );
}

export default function RoundsPage() {
  return (
    <>
      <AppHeader />
      <AuthGate>
        <RoundsContent />
      </AuthGate>
    </>
  );
}
