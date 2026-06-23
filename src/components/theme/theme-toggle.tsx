"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemePreference } from "./theme-provider";

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "Auto", Icon: Monitor },
];

/**
 * Segmented Light / Dark / Auto control, matching the toggle in the mockups.
 * "Auto" follows the OS; Light/Dark are manual overrides.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Theme"
      className="flex overflow-hidden rounded-sm border border-line bg-card"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            aria-label={label}
            onClick={() => setTheme(value)}
            className={`font-label flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] transition-colors ${
              active
                ? "bg-ink text-white dark:bg-fairway dark:text-[#04130b]"
                : "text-muted"
            }`}
          >
            <Icon className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
