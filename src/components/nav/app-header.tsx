import Link from "next/link";

/** Sticky brand header with the flag-pin mark. (Theme control lives in You → Settings.) */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 -mx-4 mb-1 border-b border-line bg-[color-mix(in_srgb,var(--bg)_86%,transparent)] px-4 backdrop-blur-md">
      <div className="flex items-center py-3.5">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Autocaddie home">
          <svg
            viewBox="0 0 24 24"
            className="size-[26px] text-text"
            fill="none"
            aria-hidden
          >
            <path d="M6 21h12" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
            <path d="M9 21V4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
            <path d="M9 4l9 3-9 3V4Z" fill="var(--flare)" />
          </svg>
          <span className="font-display text-xl font-extrabold uppercase tracking-[0.02em]">
            Autocaddie
          </span>
        </Link>
      </div>
    </header>
  );
}
