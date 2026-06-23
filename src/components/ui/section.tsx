import type { ReactNode } from "react";

/** Section header with the Flare accent bar, matching the mockups' `.sh`. */
export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="h-[15px] w-1 rounded-[3px] bg-flare" aria-hidden />
      <h2 className="font-display text-base font-bold uppercase tracking-[0.02em]">
        {title}
      </h2>
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}
