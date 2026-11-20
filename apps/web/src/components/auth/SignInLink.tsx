"use client";

import { useOptionalSignInModal } from "@/components/auth/SignInModal";
import { useAuthProvidersQuery } from "@/hooks/query/useAuthProvidersQuery";
import { isSafeAppPath } from "@/lib/auth-providers";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

type Props = {
  className?: string;
};

function returnPathForSignIn(pathname: string): string | undefined {
  const p = (pathname || "").trim();
  if (!p || !isSafeAppPath(p)) return undefined;
  if (p.startsWith("/auth/")) return undefined;
  return p;
}

/** Opens the global social sign-in modal. Label from auth_providers chrome only. */
export function SignInLink({ className }: Props) {
  const providersQuery = useAuthProvidersQuery();
  const modal = useOptionalSignInModal();
  const pathname = usePathname() || "/";
  const label = (providersQuery.data?.nav_sign_in_label || "").trim();
  if (!label) {
    return null;
  }
  return (
    <button
      type="button"
      className={cn("cursor-pointer bg-transparent p-0 text-inherit", className)}
      onClick={() => {
        const next = returnPathForSignIn(pathname);
        modal?.openSignIn(next ? { nextPath: next } : undefined);
      }}
    >
      {label}
    </button>
  );
}
