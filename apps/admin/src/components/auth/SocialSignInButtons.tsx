"use client";

import { OAuthProviderIcon } from "@/components/auth/oauth-provider-icon";
import { Button } from "@/components/ui/button";
import { ShimmerBlock } from "@/components/ui/shimmer-skeletons";
import { useAuthProvidersQuery } from "@/hooks/query/useAuthProvidersQuery";
import { resetAdminOAuthExchangeClaim } from "@/lib/oauth-exchange-latch";
import { buildOAuthProviderOptions } from "@/lib/oauth-provider-options";
import { createClient } from "@/lib/supabase/client";
import type { AuthProviderItem } from "@/types/auth-providers";
import type { Provider } from "@supabase/supabase-js";
import { useState } from "react";
import { toast } from "sonner";

type Props = {
  /** Optional override; otherwise `admin_login_default_next` from auth-providers API. */
  nextPath?: string;
};

function isSafeAppPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}

/** Google social buttons driven only by GET /public/auth-providers. */
export function SocialSignInButtons({ nextPath }: Props) {
  const providersQuery = useAuthProvidersQuery();
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);

  const items = (providersQuery.data?.items ?? []).filter(
    (item): item is AuthProviderItem =>
      Boolean(item?.id?.trim()) &&
      Boolean(item?.display_name?.trim()) &&
      Boolean(item?.action_label?.trim()) &&
      Boolean(item?.pending_label?.trim()),
  );

  const resolvedNext =
    (nextPath || "").trim() || (providersQuery.data?.admin_login_default_next || "").trim();

  async function signIn(provider: string) {
    setPendingProvider(provider);
    try {
      if (!resolvedNext || !isSafeAppPath(resolvedNext)) {
        throw new Error(
          providersQuery.data?.admin_login_default_next_missing ||
            providersQuery.data?.login_failed_message ||
            "",
        );
      }
      const callbackPath = (providersQuery.data?.site?.path_auth_callback || "").trim();
      if (!callbackPath || !isSafeAppPath(callbackPath) || resolvedNext === callbackPath) {
        throw new Error(
          providersQuery.data?.admin_login_default_next_missing ||
            providersQuery.data?.login_failed_message ||
            "",
        );
      }
      const failMsg = providersQuery.data?.login_failed_message || "";
      const supabase = createClient();
      const origin = window.location.origin;
      const options = buildOAuthProviderOptions(
        provider,
        providersQuery.data,
        `${origin}${callbackPath}?next=${encodeURIComponent(resolvedNext)}`,
        failMsg,
      );
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider as Provider,
        options: { ...options, skipBrowserRedirect: true },
      });
      if (error) {
        throw new Error(failMsg);
      }
      const url = (data?.url || "").trim();
      if (!url) {
        throw new Error(failMsg);
      }
      window.location.assign(url);
    } catch {
      const msg = (providersQuery.data?.login_failed_message || "").trim();
      if (msg) toast.error(msg);
      setPendingProvider(null);
    }
  }

  if (providersQuery.isLoading) {
    return <ShimmerBlock className="h-10 w-full rounded-md" />;
  }

  if (providersQuery.isError || !providersQuery.data) {
    return (
      <p className="text-sm text-[var(--dama-muted)]">
        {providersQuery.data?.login_auth_providers_unavailable || ""}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-[var(--dama-muted)]">
        {providersQuery.data.providers_empty_message || ""}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <Button
          key={item.id}
          type="button"
          variant="outline"
          className="w-full gap-2"
          disabled={pendingProvider !== null}
          isLoading={pendingProvider === item.id}
          pendingLabel={item.pending_label}
          onClick={() => void signIn(item.id)}
        >
          <OAuthProviderIcon provider={item.id} />
          {item.action_label}
        </Button>
      ))}
    </div>
  );
}
