import type { ReactNode } from "react";
import { AppHeader } from "@/components/nav/app-header";

/**
 * Placeholder for routes whose real screens arrive in later phases. Keeps the
 * nav shell complete and on-brand without faking functionality.
 */
export function StubPage({
  eyebrow,
  title,
  icon,
  children,
}: {
  eyebrow: string;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
        {icon && (
          <div className="flex size-16 items-center justify-center rounded-xl bg-field text-muted">
            {icon}
          </div>
        )}
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="font-display mt-1 text-4xl font-extrabold uppercase leading-none">
            {title}
          </h1>
        </div>
        <p className="max-w-[34ch] text-sm text-muted">{children}</p>
      </main>
    </>
  );
}
