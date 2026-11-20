"use client";

import { SignInLink } from "@/components/auth/SignInLink";
import { PlayerProfileModal } from "@/components/player/PlayerProfileModal";
import { ProfileMyTournaments } from "@/components/profile/ProfileMyTournaments";
import { HostTrustBadge } from "@/components/trust/HostTrustBadge";
import { DamaUserAvatar } from "@/components/ui/DamaUserAvatar";
import { Button } from "@/components/ui/button";
import {
  ProfilePageSkeleton,
  ShimmerBlock,
  SkipPaginationSkeleton,
} from "@/components/ui/shimmer-skeletons";
import { SkipPagination } from "@/components/ui/skip-pagination";
import { useAvatarUploadMutation } from "@/hooks/mutation/useAvatarUploadMutation";
import { useAvatarChromeQuery } from "@/hooks/query/useAvatarChromeQuery";
import { useClientNavFullQuery } from "@/hooks/query/useClientNavFullQuery";
import { useMeQuery } from "@/hooks/query/useMeQuery";
import { useMyMatchesPagedQuery } from "@/hooks/query/useMyMatchesQuery";
import { useProfileInspectChromeQuery } from "@/hooks/query/useProfileInspectChromeQuery";
import { useResetSkipOnChange } from "@/hooks/useResetSkipOnChange";
import { useUrlSkip } from "@/hooks/useUrlSkip";
import { apiToastMessage } from "@/lib/api-toast-message";
import { CountryFlag } from "@/lib/country-flag";
import { hostReputationLine } from "@/lib/host-reputation-line";
import { cn } from "@/lib/utils";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { isAvatarChromeReady } from "@/types/avatar-chrome";
import { isPlayerDashboardChromeReady } from "@/types/platform";
import { isProfileInspectChromeReady } from "@/types/profile-inspect-chrome";
import { Camera, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

function parseListPageSize(raw: string | undefined): number {
  const n = Number.parseInt(String(raw || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Career identity only - KYC / privacy / session live on Settings. */
export default function ProfilePage() {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const authUser = useAuthStore((s) => s.user);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [matchesSkip, setMatchesSkip] = useUrlSkip("matches_skip");
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useAvatarUploadMutation(token);
  const avatarChromeQuery = useAvatarChromeQuery(true);
  const inspectChromeQuery = useProfileInspectChromeQuery(true);
  const navQuery = useClientNavFullQuery(true);
  const avatarChrome = isAvatarChromeReady(avatarChromeQuery.data)
    ? avatarChromeQuery.data
    : undefined;
  const inspectChrome = isProfileInspectChromeReady(inspectChromeQuery.data)
    ? inspectChromeQuery.data
    : undefined;
  const nav = isPlayerDashboardChromeReady(navQuery.data) ? navQuery.data : undefined;
  const settingsPanel = (nav?.dashboard ?? []).find(
    (p) => (p.route_key || "").trim() === "settings",
  );
  const settingsHref = (settingsPanel?.href || "").trim();
  const settingsLabel = (settingsPanel?.title || "").trim();

  const { data, isLoading, error } = useMeQuery(token);
  const listPageSize = parseListPageSize(inspectChrome?.list_page_size);
  const matchesQuery = useMyMatchesPagedQuery(
    token,
    matchesSkip,
    listPageSize,
    Boolean(token) && listPageSize > 0,
  );

  useResetSkipOnChange(setMatchesSkip, [token]);

  function onUpload(file: File) {
    if (!avatarChrome) return;
    upload.mutate(file, {
      onSuccess: () => {
        toast.success(avatarChrome.toast_updated);
      },
      onError: (err) => {
        toast.error(apiToastMessage(err, avatarChrome.upload_failed));
      },
    });
  }

  if (
    !hydrated ||
    avatarChromeQuery.isLoading ||
    inspectChromeQuery.isLoading ||
    navQuery.isLoading
  ) {
    return <ProfilePageSkeleton />;
  }

  if (!avatarChrome || !inspectChrome || !nav || !settingsHref || !settingsLabel) {
    const unavailable =
      (avatarChromeQuery.data?.avatar_chrome_unavailable || "").trim() ||
      (inspectChromeQuery.data?.profile_inspect_chrome_unavailable || "").trim() ||
      (navQuery.data?.settings_unavailable || "").trim() ||
      (navQuery.data?.dashboard_unavailable || "").trim() ||
      (avatarChromeQuery.error instanceof Error ? avatarChromeQuery.error.message : "").trim();
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--dama-danger)]">{unavailable}</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-bold">{avatarChrome.profile_page_title}</h1>
        <Button asChild variant="gold">
          <SignInLink />
        </Button>
      </div>
    );
  }

  const matches = matchesQuery.data?.matches ?? [];
  const matchesMeta = matchesQuery.data?.meta ?? null;
  // Prefer auth write-through (upload / WS) over me query cache.
  const thumb =
    authUser?.avatarThumbUrl ||
    authUser?.avatarFullUrl ||
    data?.avatarThumbUrl ||
    data?.avatarFullUrl ||
    "";

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {avatarChrome.profile_page_title}
          </h1>
          {(avatarChrome.page_blurb || "").trim() ? (
            <p className="mt-1 max-w-2xl text-sm text-[var(--dama-muted)]">
              {(avatarChrome.page_blurb || "").trim()}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={settingsHref}>{settingsLabel}</Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-2" aria-hidden>
          <div className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-5 shadow-[var(--dama-card-shadow)]">
            <div className="flex items-center gap-4">
              <ShimmerBlock className="h-20 w-20 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <ShimmerBlock className="h-4 w-36" />
                <ShimmerBlock className="h-3 w-48 max-w-full" />
                <ShimmerBlock className="h-3 w-28" />
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <ShimmerBlock className="h-16 w-full rounded-md" />
              <ShimmerBlock className="h-16 w-full rounded-md" />
              <ShimmerBlock className="h-16 w-full rounded-md" />
            </div>
          </div>
          <div className="space-y-3 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-5 shadow-[var(--dama-card-shadow)]">
            <ShimmerBlock className="h-4 w-32" />
            <ul className="mt-3 max-h-[220px] space-y-2 overflow-hidden">
              {["m0", "m1", "m2", "m3"].map((id) => (
                <li
                  key={id}
                  className="flex items-center justify-between rounded-md border border-[var(--dama-border)] px-3 py-2"
                >
                  <ShimmerBlock className="h-3.5 w-24" />
                  <ShimmerBlock className="h-3.5 w-20" />
                </li>
              ))}
            </ul>
            <SkipPaginationSkeleton className="mt-3" />
          </div>
        </div>
      ) : null}
      {error ? (
        <p className="text-sm text-[var(--dama-danger)]">{avatarChrome.profile_load_failed}</p>
      ) : null}

      {data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-5 shadow-[var(--dama-card-shadow)]">
            <div className="flex items-center gap-4">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) onUpload(file);
                }}
              />
              <button
                type="button"
                disabled={upload.isPending}
                aria-label={avatarChrome.change_photo_aria}
                title={avatarChrome.change_photo_aria}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "group relative h-20 w-20 shrink-0 overflow-hidden rounded-full",
                  "bg-[var(--dama-surface)] ring-2 ring-[var(--dama-border)]",
                  "transition duration-200 hover:ring-[var(--dama-gold)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dama-gold)]",
                  "disabled:cursor-wait disabled:opacity-80",
                )}
              >
                <DamaUserAvatar src={thumb} className="h-full w-full rounded-full" />
                <span
                  className={cn(
                    "absolute inset-0 flex flex-col items-center justify-center gap-0.5",
                    "bg-black/55 text-white opacity-0 transition duration-200",
                    "group-hover:opacity-100 group-focus-visible:opacity-100",
                    upload.isPending && "opacity-100",
                  )}
                  aria-hidden
                >
                  {upload.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Camera className="h-5 w-5" strokeWidth={1.75} />
                  )}
                </span>
              </button>
              <button
                type="button"
                className="min-w-0 flex-1 text-left transition hover:opacity-90"
                onClick={() => setInspectOpen(true)}
              >
                <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                  <span className="truncate">{data.username}</span>
                  <CountryFlag code={data.countryCode} />
                  <HostTrustBadge
                    label={data.hostTrustBadge}
                    tier={data.hostTrustTier}
                    className="shrink-0 text-[10px]"
                  />
                </p>
                {(() => {
                  const rep = hostReputationLine({
                    finished: data.hostFinishedPaidCups,
                    cancelled: data.hostCancelledPaidCups,
                    openReports: data.hostOpenReports,
                    finishedLabel: inspectChrome.host_rep_finished_label,
                    cancelledLabel: inspectChrome.host_rep_cancelled_label,
                    reportsLabel: inspectChrome.host_rep_reports_label,
                    separator: inspectChrome.host_rep_meta_separator,
                  });
                  return rep ? <p className="text-[11px] text-[var(--dama-muted)]">{rep}</p> : null;
                })()}
                <p className="text-sm text-[var(--dama-muted)]">
                  {inspectChrome.label_rating} {data.rating}
                  {inspectChrome.seat_meta_separator}
                  {inspectChrome.label_xp} {data.xp}
                </p>
                <p className="text-xs text-[var(--dama-gold)]">{avatarChrome.tap_inspect_hint}</p>
              </button>
            </div>
            <dl className="mt-6 grid grid-cols-3 gap-3 text-center text-sm">
              <div className="rounded-md border border-[var(--dama-border)] p-3">
                <dt className="text-[var(--dama-muted)]">{inspectChrome.label_wins}</dt>
                <dd className="font-mono text-[var(--dama-gold)]">{data.wins}</dd>
              </div>
              <div className="rounded-md border border-[var(--dama-border)] p-3">
                <dt className="text-[var(--dama-muted)]">{inspectChrome.label_losses}</dt>
                <dd className="font-mono text-[var(--dama-gold)]">{data.losses}</dd>
              </div>
              <div className="rounded-md border border-[var(--dama-border)] p-3">
                <dt className="text-[var(--dama-muted)]">{inspectChrome.label_draws}</dt>
                <dd className="font-mono text-[var(--dama-gold)]">
                  {"draws" in data && typeof (data as { draws?: number }).draws === "number"
                    ? String((data as { draws?: number }).draws)
                    : (inspectChrome.empty_value || "").trim()}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-5 shadow-[var(--dama-card-shadow)]">
            <h2 className="text-sm font-semibold text-[var(--dama-gold)]">
              {inspectChrome.recent_matches_title}
            </h2>
            {matches.length === 0 && !matchesQuery.isFetching ? (
              <p className="mt-2 text-sm text-[var(--dama-muted)]">{inspectChrome.no_matches}</p>
            ) : (
              <>
                <ul className="mt-3 max-h-[220px] space-y-2 overflow-y-auto overscroll-contain text-sm">
                  {matches.map((m) => {
                    const moves =
                      typeof m.move_count === "number"
                        ? String(m.move_count)
                        : (inspectChrome.empty_value || "").trim();
                    const outcome = m.is_draw
                      ? inspectChrome.outcome_draw
                      : m.is_free
                        ? `${inspectChrome.free_suffix}${inspectChrome.seat_meta_separator}${moves} ${inspectChrome.moves_suffix}`
                        : `${moves} ${inspectChrome.moves_suffix}`;
                    return (
                      <li
                        key={m.id}
                        className="flex items-center justify-between rounded-md border border-[var(--dama-border)] px-3 py-2"
                      >
                        <span className="text-[var(--dama-muted)]">{m.mode || m.id}</span>
                        <span className="font-mono text-[var(--dama-gold)]">{outcome}</span>
                      </li>
                    );
                  })}
                </ul>
                <SkipPagination
                  className="mt-3"
                  meta={matchesMeta}
                  disabled={matchesQuery.isFetching}
                  onPrev={setMatchesSkip}
                  onNext={setMatchesSkip}
                />
              </>
            )}
          </div>

          <ProfileMyTournaments />
        </div>
      ) : null}

      <PlayerProfileModal
        open={inspectOpen}
        onOpenChange={setInspectOpen}
        player={
          data
            ? {
                id: data.id,
                username: data.username,
                rating: data.rating,
                xp: data.xp,
                wins: data.wins,
                losses: data.losses,
                region: data.region,
                avatarFullUrl: data.avatarFullUrl,
                avatarThumbUrl: data.avatarThumbUrl,
              }
            : null
        }
      />
    </div>
  );
}
