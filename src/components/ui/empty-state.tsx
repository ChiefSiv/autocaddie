import type { ReactNode } from "react";

/**
 * Empty states are invitations, never dead ends (§ cross-cutting).
 * e.g. "No rounds yet — start your first."
 */
export function EmptyState({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line bg-card/40 px-5 py-8 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <p className="max-w-[36ch] text-sm text-muted">{children}</p>
    </div>
  );
}
