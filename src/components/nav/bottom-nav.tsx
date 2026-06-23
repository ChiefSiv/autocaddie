"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ListOrdered, Plus, Users, User } from "lucide-react";

type Tab = {
  href: string;
  label: string;
  Icon: typeof Home;
};

const LEFT: Tab[] = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/rounds", label: "Rounds", Icon: ListOrdered },
];
const RIGHT: Tab[] = [
  { href: "/friends", label: "Friends", Icon: Users },
  { href: "/you", label: "You", Icon: User },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function TabLink({ tab, pathname }: { tab: Tab; pathname: string }) {
  const active = isActive(pathname, tab.href);
  return (
    <Link
      href={tab.href}
      aria-label={tab.label}
      aria-current={active ? "page" : undefined}
      className={`font-label flex flex-1 flex-col items-center gap-1 text-[10px] uppercase tracking-[0.06em] transition-colors ${
        active ? "text-text" : "text-muted"
      }`}
    >
      <tab.Icon className="size-[22px]" strokeWidth={2} aria-hidden />
      {tab.label}
    </Link>
  );
}

/** 5-slot bottom tab bar with the Flare "+ Play" action raised in the center. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-[560px] items-center justify-around px-2 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2">
        {LEFT.map((tab) => (
          <TabLink key={tab.href} tab={tab} pathname={pathname} />
        ))}

        <div className="-mt-[22px] flex-none">
          <Link
            href="/play"
            aria-label="Start or join a round"
            className="flex size-[60px] items-center justify-center rounded-xl bg-flare text-white shadow-[0_8px_20px_-6px_color-mix(in_srgb,var(--flare)_60%,transparent)] transition-transform active:scale-95"
          >
            <Plus className="size-7" strokeWidth={2.5} aria-hidden />
          </Link>
          <span className="font-label mt-1 block text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-flare">
            Play
          </span>
        </div>

        {RIGHT.map((tab) => (
          <TabLink key={tab.href} tab={tab} pathname={pathname} />
        ))}
      </div>
    </nav>
  );
}
