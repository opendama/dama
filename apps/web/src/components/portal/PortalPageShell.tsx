import type { ReactNode } from "react";

/** Trim-style portal page body (width capped by player portal layout). */
export function PortalPageShell({
  children,
  title,
  blurb,
  eyebrow,
  actions,
}: {
  children: ReactNode;
  title?: string;
  blurb?: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="w-full space-y-6">
      {title?.trim() ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0">
            {eyebrow?.trim() ? (
              <p className="text-sm text-[var(--dama-muted)]">{eyebrow.trim()}</p>
            ) : null}
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              {title.trim()}
            </h1>
            {blurb?.trim() ? (
              <p className="mt-1 max-w-2xl text-sm text-[var(--dama-muted)]">{blurb.trim()}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
