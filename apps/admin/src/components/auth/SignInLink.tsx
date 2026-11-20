"use client";

import { useAuthProvidersQuery } from "@/hooks/query/useAuthProvidersQuery";
import { resolveLoginPath } from "@/lib/auth-providers";
import Link from "next/link";

type Props = {
  className?: string;
};

/** Href + label only from auth_providers chrome (fail closed; no invent children). */
export function SignInLink({ className }: Props) {
  const providersQuery = useAuthProvidersQuery();
  const href = resolveLoginPath(providersQuery.data);
  const label = (providersQuery.data?.nav_sign_in_label || "").trim();
  if (!label) {
    return null;
  }
  if (!href) {
    return <span className={className}>{label}</span>;
  }
  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}
