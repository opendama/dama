"use client";

import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { SignInLink } from "@/components/auth/SignInLink";
import { HostSizesCatalogSection } from "@/components/events/HostSizesCatalogSection";
import { GalleryCarousel } from "@/components/media/GalleryCarousel";
import { MediaProofGallery } from "@/components/media/MediaProofGallery";
import { HostTrustBadge } from "@/components/trust/HostTrustBadge";
import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  type OpsColumn,
  OpsDataTable,
  type OpsRowSelectionState,
  selectedRowIds,
} from "@/components/ui/ops-data-table";
import { OpsDataTableRowActions } from "@/components/ui/ops-data-table-row-actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EventsBodySkeleton,
  EventsPageSkeleton,
  FormCardSkeleton,
  OpsDataTableSkeleton,
} from "@/components/ui/shimmer-skeletons";
import { SkipPagination } from "@/components/ui/skip-pagination";
import {
  useDeactivateEventReportMutation,
  useDismissEventReportMutation,
  useSaveEventsCatalogMutation,
  useSetFeatureFlagMutation,
} from "@/hooks/mutation";
import {
  type ConsoleEventEntryFilter,
  useAdminEventEntriesQuery,
  useClientEnumsQuery,
  useConsoleFeatureFlagsQuery,
  useConsoleHostedEventsQuery,
  useEventReportsQuery,
  useEventsAdminChromeQuery,
  useEventsCatalogQuery,
  useMyPermissionsQuery,
} from "@/hooks/query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDeferredDialogValue } from "@/hooks/use-deferred-dialog-selection";
import { useIsConsoleRole } from "@/hooks/useIsConsoleRole";
import { useResetSkipOnChange } from "@/hooks/useResetSkipOnChange";
import { useUrlSkip } from "@/hooks/useUrlSkip";
import { restClient } from "@/lib/api";
import { hostReputationLine } from "@/lib/host-reputation-line";
import { parseListPageSize } from "@/lib/parse-list-page-size";
import { resolvePublicMediaUrl } from "@/lib/resolve-public-media-url";
import { sanitizeIntegerInput } from "@/lib/sanitize-integer-input";
import { formatSeatCapDisplay } from "@/lib/seat-cap-display";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { isEventsAdminChromeReady } from "@/types/events-admin-chrome";
import type { EventsCatalogConfig, EventsCatalogFormat } from "@/types/events-catalog";
import type { HostedEventReport } from "@/types/event-reports";
import type { HostedEventConsoleRow } from "@/types/hosted-events-console";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

function parseSearchDebounceMs(raw: string | undefined): number {
  const n = Number.parseInt(String(raw || "").trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : 250;
}

function formatDay(raw: string | undefined, empty: string): string {
  const day = (raw || "").trim().slice(0, 10);
  return day || empty;
}

function formatMoney(
  amount: number | undefined,
  currency: string | undefined,
  sep: string,
  empty: string,
): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return empty;
  const cur = (currency || "").trim();
  if (!cur || sep.length === 0) return empty;
  return `${amount}${sep}${cur}`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!(label || "").trim()) return null;
  return (
    <div className="min-w-0">
      <p className="text-xs text-[var(--dama-muted)]">{label}</p>
      <p className="break-words text-sm font-medium">{value}</p>
    </div>
  );
}

type EventsTab = "hosted" | "flags" | "reports" | "catalog" | "sizes";

function cloneCatalog(data: EventsCatalogConfig): EventsCatalogConfig {
  return {
    join_code_length: data.join_code_length,
    join_code_alphabet: data.join_code_alphabet,
    auto_approve_default: data.auto_approve_default,
    force_auto_approve: data.force_auto_approve === true,
    public_host_fee_multiplier: data.public_host_fee_multiplier,
    default_visibility: data.default_visibility,
    report_reason_codes: [...(data.report_reason_codes ?? [])],
    report_reason_labels: { ...(data.report_reason_labels ?? {}) },
    entry_fee_commission_percent: data.entry_fee_commission_percent,
    share_path_template: data.share_path_template,
    qr_filename_prefix: data.qr_filename_prefix,
    min_players_to_start: { ...data.min_players_to_start },
    swiss_rounds_by_max_players: { ...data.swiss_rounds_by_max_players },
    groups_knockout_target_group_size: data.groups_knockout_target_group_size,
    groups_knockout_advance_per_group: data.groups_knockout_advance_per_group,
    formats: data.formats.map((f) => ({ ...f })),
    sizes: data.sizes.map((s) => ({
      ...s,
      allowed_format_ids: [...s.allowed_format_ids],
    })),
  };
}

export default function ConsoleEventsCatalogPage() {
  const token = useAuthStore((s) => s.token);
  const searchParams = useSearchParams();
  const focusReportId = (searchParams.get("report") || "").trim();
  const focusEventId = (searchParams.get("id") || "").trim();
  const eventFocusOpened = useRef("");
  const [tab, setTab] = useState<EventsTab>("hosted");
  const eventsTabDefaulted = useRef(false);
  const { isConsole: isAdmin, isLoading: roleLoading } = useIsConsoleRole();
  const chromeQuery = useEventsAdminChromeQuery(true);
  const chrome = isEventsAdminChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const enumsQuery = useClientEnumsQuery(isAdmin);
  const reportStatusLabels = enumsQuery.data?.hosted_event_report_status_labels ?? {};
  const pageSize = parseListPageSize(chrome?.list_page_size);
  const searchDebounceMs = parseSearchDebounceMs(chrome?.search_debounce_ms);
  const [hostedSkip, setHostedSkip] = useUrlSkip("hosted_skip");
  const [hostedEntryFilter, setHostedEntryFilter] = useState<ConsoleEventEntryFilter>("all");
  const [hostedSearchDraft, setHostedSearchDraft] = useState("");
  const hostedSearchQ = useDebouncedValue(hostedSearchDraft.trim(), searchDebounceMs);
  const [hostedRowSelection, setHostedRowSelection] = useState<OpsRowSelectionState>({});
  const detailEventDialog = useDeferredDialogValue<HostedEventConsoleRow>();
  const detailEvent = detailEventDialog.value;
  const detailReportDialog = useDeferredDialogValue<HostedEventReport>();
  const detailReport = detailReportDialog.value;
  const [detailEntriesSkip, setDetailEntriesSkip] = useState(0);
  const [reportsSkip, setReportsSkip] = useUrlSkip("reports_skip");
  const [reportsRowSelection, setReportsRowSelection] = useState<OpsRowSelectionState>({});
  const [reportsBulkPending, setReportsBulkPending] = useState(false);
  const [pinnedFocusEvent, setPinnedFocusEvent] = useState<HostedEventConsoleRow | null>(null);
  useResetSkipOnChange(setHostedSkip, [hostedEntryFilter, hostedSearchQ]);
  useResetSkipOnChange(setDetailEntriesSkip, [detailEvent?.id || ""]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: clear selection when list context changes
  useEffect(() => {
    setHostedRowSelection({});
  }, [hostedEntryFilter, hostedSearchQ, hostedSkip]);

  const permsQuery = useMyPermissionsQuery(token, isAdmin);
  const permissionKey = (chrome?.permission_key || "").trim();
  const reportsPermissionKey = (chrome?.reports_permission_key || "").trim();
  const canManage =
    Boolean(permissionKey) && permsQuery.data?.permissions?.includes(permissionKey) === true;
  const canManageReports =
    Boolean(reportsPermissionKey) &&
    permsQuery.data?.permissions?.includes(reportsPermissionKey) === true;
  const detailEntriesQuery = useAdminEventEntriesQuery(
    token,
    detailEvent?.id || "",
    detailEntriesSkip,
    pageSize,
    Boolean(detailEvent?.id) && canManage && pageSize > 0,
  );
  const detailEntries = detailEntriesQuery.data?.entries ?? [];
  const detailEntriesMeta = detailEntriesQuery.data?.meta;

  useEffect(() => {
    if (focusReportId && canManageReports) setTab("reports");
  }, [focusReportId, canManageReports]);

  useEffect(() => {
    if (focusEventId && canManage) setTab("hosted");
  }, [focusEventId, canManage]);

  useEffect(() => {
    if (!canManage && !canManageReports) return;
    if (!eventsTabDefaulted.current) {
      eventsTabDefaulted.current = true;
      if (focusReportId && canManageReports) {
        setTab("reports");
      } else if (focusEventId && canManage) {
        setTab("hosted");
      } else {
        setTab(canManage ? "hosted" : "reports");
      }
      return;
    }
    const manageTabs: EventsTab[] = ["hosted", "flags", "catalog", "sizes"];
    if (manageTabs.includes(tab) && !canManage) {
      setTab(canManageReports ? "reports" : "hosted");
    }
    if (tab === "reports" && !canManageReports) {
      setTab(canManage ? "hosted" : "reports");
    }
  }, [canManage, canManageReports, tab, focusReportId, focusEventId]);

  const catalogQuery = useEventsCatalogQuery(token, isAdmin && canManage, chrome?.load_failed);
  const save = useSaveEventsCatalogMutation(token);
  const flagsQuery = useConsoleFeatureFlagsQuery(token);
  const setFlag = useSetFeatureFlagMutation(token);
  const reportOpenStatus = (enumsQuery.data?.hosted_event_report_open_status || "").trim();
  const reportsQuery = useEventReportsQuery(
    token,
    isAdmin && canManageReports && Boolean(reportOpenStatus),
    reportOpenStatus,
    reportsSkip,
    pageSize,
  );
  const hostedEventsQuery = useConsoleHostedEventsQuery(
    token,
    isAdmin && canManage,
    hostedSkip,
    pageSize,
    hostedEntryFilter,
    hostedSearchQ,
  );
  const dismissReport = useDismissEventReportMutation(token);
  const deactivateReport = useDeactivateEventReportMutation(token);
  // biome-ignore lint/correctness/useExhaustiveDependencies: clear selection when reports page/data changes
  useEffect(() => {
    setReportsRowSelection({});
  }, [reportsSkip, reportsQuery.data?.reports]);

  async function bulkEventReports(kind: "dismiss" | "deactivate") {
    const ids = selectedRowIds(reportsRowSelection);
    if (!ids.length) return;
    setReportsBulkPending(true);
    try {
      for (const id of ids) {
        if (kind === "dismiss") await dismissReport.mutateAsync(id);
        else await deactivateReport.mutateAsync(id);
      }
      setReportsRowSelection({});
      if (detailReport && ids.includes(detailReport.id)) detailReportDialog.close();
    } finally {
      setReportsBulkPending(false);
    }
  }

  const [draft, setDraft] = useState<EventsCatalogConfig | null>(null);

  const swissRoundsByMax = draft?.swiss_rounds_by_max_players || {};

  const hostedColumns = useMemo<OpsColumn<HostedEventConsoleRow>[]>(() => {
    if (!chrome) return [];
    const empty = chrome.empty_value;
    const thumbHeader = (chrome.thumbnail_label || "").trim();
    const cols: OpsColumn<HostedEventConsoleRow>[] = [
      ...(thumbHeader
        ? [
            {
              id: "thumbnail",
              header: thumbHeader,
              className: "w-16",
              cell: (row: HostedEventConsoleRow) => {
                // Official list parity: prize → first gallery. Branding logo stays on detail only.
                const prize = (row.prize_image_url || "").trim();
                const galleryFirst = (row.gallery ?? []).map((u) => (u || "").trim()).find(Boolean);
                const thumbRaw = prize || galleryFirst || "";
                const src = resolvePublicMediaUrl(thumbRaw);
                return src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" className="h-10 w-10 rounded object-cover" />
                ) : (
                  <span className="text-xs text-[var(--dama-muted)]">{empty}</span>
                );
              },
            } satisfies OpsColumn<HostedEventConsoleRow>,
          ]
        : []),
      {
        id: "title",
        header: chrome.hosted_col_title,
        cell: (row) => <span className="font-medium">{row.title}</span>,
      },
      {
        id: "entry",
        header: chrome.hosted_col_entry,
        cell: (row) => {
          const sep = chrome.amount_currency_separator;
          const maxLabel = (chrome.max_players_label || "").trim();
          const maxVal = formatSeatCapDisplay(
            row.max_players,
            swissRoundsByMax,
            chrome.unlimited_players_label || "",
            empty,
          );
          return (
            <div className="text-xs">
              <p>
                {row.is_free_entry === true
                  ? chrome.filter_free_label
                  : row.is_free_entry === false
                    ? chrome.filter_paid_label
                    : empty}
              </p>
              {row.is_free_entry !== true ? (
                <p className="mt-0.5 font-mono text-[var(--dama-gold)]">
                  {formatMoney(row.entry_fee_amount, row.entry_fee_currency, sep, empty)}
                </p>
              ) : null}
              {maxLabel ? (
                <p className="mt-0.5 text-[var(--dama-muted)]">
                  {maxLabel} {maxVal}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "prize",
        header: chrome.detail_prize_now_label,
        cell: (row) => {
          if (row.prize_pool_display_enabled && row.prize_pool_now != null) {
            return (
              <span className="font-mono text-xs">
                {formatMoney(
                  row.prize_pool_now,
                  row.prize_pool_currency,
                  chrome.amount_currency_separator,
                  empty,
                )}
              </span>
            );
          }
          return <span className="font-mono text-xs">{empty}</span>;
        },
      },
      {
        id: "status",
        header: chrome.hosted_col_status,
        cell: (row) => <span className="text-xs">{(row.status_label || "").trim() || empty}</span>,
      },
      {
        id: "organizer",
        header: chrome.hosted_col_organizer,
        cell: (row) => {
          const name = (row.organizer_username || "").trim() || empty;
          const rep = hostReputationLine({
            finished: row.organizer_finished_paid_cups,
            cancelled: row.organizer_cancelled_paid_cups,
            openReports: row.organizer_open_reports,
            finishedLabel: chrome.host_rep_finished_label,
            cancelledLabel: chrome.host_rep_cancelled_label,
            reportsLabel: chrome.host_rep_reports_label,
            separator: chrome.host_rep_meta_separator,
          });
          return (
            <span className="flex min-w-0 flex-col gap-0.5 text-sm">
              <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="min-w-0 truncate">{name}</span>
                <HostTrustBadge
                  label={row.organizer_host_trust_badge}
                  tier={row.organizer_host_trust_tier}
                  className="shrink-0"
                />
              </span>
              {rep ? (
                <span className="truncate text-[10px] text-[var(--dama-muted)]" title={rep}>
                  {rep}
                </span>
              ) : null}
            </span>
          );
        },
      },
      {
        id: "code",
        header: chrome.hosted_col_code,
        cell: (row) => <span className="font-mono text-xs">{row.join_code}</span>,
      },
      {
        id: "players",
        header: chrome.hosted_col_players,
        cell: (row) => (
          <span className="font-mono text-xs">
            {typeof row.approved_count === "number" ? row.approved_count : empty}/
            {formatSeatCapDisplay(
              row.max_players,
              swissRoundsByMax,
              chrome.unlimited_players_label || "",
              empty,
            )}
          </span>
        ),
      },
      {
        id: "visibility",
        header: chrome.hosted_col_visibility,
        cell: (row) => (
          <span className="text-xs">{(row.visibility_label || "").trim() || empty}</span>
        ),
      },
      {
        id: "created",
        header: chrome.hosted_col_created,
        cell: (row) => (
          <span className="text-xs text-[var(--dama-muted)]">
            {formatDay(row.created_at, empty)}
          </span>
        ),
      },
      {
        id: "actions",
        header: chrome.hosted_col_actions,
        className: "w-12 text-right",
        cell: (row) => (
          <OpsDataTableRowActions
            triggerLabel={(chrome.hosted_col_actions || "").trim()}
            actions={[
              {
                id: "view",
                label: (chrome.view_detail_action || "").trim(),
                onSelect: () => detailEventDialog.openWith(row),
              },
            ]}
          />
        ),
      },
    ];
    return cols.filter((c) => c.id === "actions" || Boolean((c.header || "").trim()));
  }, [chrome, detailEventDialog.openWith, swissRoundsByMax]);

  const reportsColumns = useMemo<OpsColumn<HostedEventReport>[]>(() => {
    if (!chrome) return [];
    const empty = chrome.empty_value;
    const cols: OpsColumn<HostedEventReport>[] = [
      {
        id: "event",
        header: chrome.report_event_col,
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{(row.event_title || "").trim() || empty}</p>
            {row.event_join_code ? (
              <p className="truncate font-mono text-xs text-[var(--dama-muted)]">
                {row.event_join_code}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        id: "reporter",
        header: chrome.report_reporter_col,
        cell: (row) => (
          <span className="truncate text-sm">{(row.reporter_username || "").trim() || empty}</span>
        ),
      },
      {
        id: "reason",
        header: chrome.report_reason_col,
        cell: (row) => (
          <div className="min-w-0 max-w-xs">
            <p className="truncate text-sm">{(row.reason_label || "").trim() || empty}</p>
            {row.note.trim() ? (
              <p className="mt-0.5 truncate text-xs text-[var(--dama-muted)]">{row.note}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: "status",
        header: chrome.report_status_col,
        cell: (row) => (
          <span className="text-xs">{(reportStatusLabels[row.status] || "").trim() || empty}</span>
        ),
      },
      {
        id: "actions",
        header: chrome.hosted_col_actions,
        className: "w-12 text-right",
        cell: (row) => (
          <OpsDataTableRowActions
            triggerLabel={(chrome.hosted_col_actions || "").trim()}
            actions={[
              {
                id: "view",
                label: (chrome.view_detail_action || "").trim(),
                onSelect: () => detailReportDialog.openWith(row),
              },
              {
                id: "dismiss",
                label: (chrome.dismiss_action || "").trim(),
                disabled: dismissReport.isPending || deactivateReport.isPending,
                isLoading: dismissReport.isPending && dismissReport.variables === row.id,
                pendingLabel: chrome.save_pending,
                onSelect: () => dismissReport.mutate(row.id),
              },
              {
                id: "deactivate",
                label: (chrome.deactivate_action || "").trim(),
                destructive: true,
                disabled: dismissReport.isPending || deactivateReport.isPending,
                isLoading: deactivateReport.isPending && deactivateReport.variables === row.id,
                pendingLabel: chrome.save_pending,
                onSelect: () => deactivateReport.mutate(row.id),
              },
            ]}
          />
        ),
      },
    ];
    return cols.filter((c) => c.id === "actions" || Boolean((c.header || "").trim()));
  }, [
    chrome,
    detailReportDialog.openWith,
    reportStatusLabels,
    dismissReport.isPending,
    dismissReport.mutate,
    dismissReport.variables,
    deactivateReport.isPending,
    deactivateReport.mutate,
    deactivateReport.variables,
  ]);

  useEffect(() => {
    if (!catalogQuery.data) return;
    setDraft(cloneCatalog(catalogQuery.data));
  }, [catalogQuery.data]);

  useEffect(() => {
    if (!focusReportId || !reportsQuery.data?.reports?.length) return;
    const el = document.getElementById(`ops-row-${focusReportId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusReportId, reportsQuery.data?.reports]);

  useEffect(() => {
    if (!focusEventId) {
      setPinnedFocusEvent(null);
      eventFocusOpened.current = "";
      return;
    }
    if (!token || !canManage || eventFocusOpened.current === focusEventId) return;
    const rows = hostedEventsQuery.data?.events ?? [];
    if (rows.some((e) => e.id === focusEventId)) {
      eventFocusOpened.current = focusEventId;
      setPinnedFocusEvent(null);
      return;
    }
    if (hostedEventsQuery.isLoading || hostedEventsQuery.isFetching) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await restClient.get<HostedEventConsoleRow>(
          `/console/events/${encodeURIComponent(focusEventId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (cancelled || !data?.id) return;
        eventFocusOpened.current = focusEventId;
        setPinnedFocusEvent(data);
      } catch {
        if (!cancelled) eventFocusOpened.current = focusEventId;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    focusEventId,
    token,
    canManage,
    hostedEventsQuery.data?.events,
    hostedEventsQuery.isLoading,
    hostedEventsQuery.isFetching,
  ]);

  const hostedDisplayRows = useMemo(() => {
    const rows = hostedEventsQuery.data?.events ?? [];
    if (
      pinnedFocusEvent?.id &&
      focusEventId &&
      pinnedFocusEvent.id === focusEventId &&
      !rows.some((e) => e.id === pinnedFocusEvent.id)
    ) {
      return [pinnedFocusEvent, ...rows];
    }
    return rows;
  }, [hostedEventsQuery.data?.events, pinnedFocusEvent, focusEventId]);

  useEffect(() => {
    if (!focusEventId) return;
    if (!hostedDisplayRows.some((e) => e.id === focusEventId)) return;
    const el = document.getElementById(`ops-row-${focusEventId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusEventId, hostedDisplayRows]);

  if (chromeQuery.isLoading) {
    return (
      <div className="space-y-6">
        <EventsPageSkeleton tab={tab} />
      </div>
    );
  }

  if (!chrome) {
    const unavailable = (chromeQuery.data?.events_admin_chrome_unavailable || "").trim();
    return unavailable ? (
      <div className="p-6 text-sm text-[var(--dama-muted)]">{unavailable}</div>
    ) : null;
  }

  if (roleLoading || (isAdmin && permsQuery.isLoading)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{chrome.page_title}</h1>
          <p className="mt-1 text-sm text-[var(--dama-muted)]">{chrome.page_blurb}</p>
        </div>
        <EventsBodySkeleton tab={tab} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{chrome.page_title}</h1>
          <p className="mt-1 text-sm text-[var(--dama-muted)]">{chrome.page_blurb}</p>
        </div>
        <p className="rounded-md border border-[var(--dama-border)] p-4 text-sm">
          <SignInLink className="text-[var(--dama-gold)] underline" />
        </p>
      </div>
    );
  }

  if (!canManage && !canManageReports) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{chrome.page_title}</h1>
          <p className="mt-1 text-sm text-[var(--dama-muted)]">{chrome.page_blurb}</p>
        </div>
        <output className="block text-sm text-[var(--dama-muted)]" data-error="events_perms">
          {chrome.lacks_permissions}
        </output>
      </div>
    );
  }

  const pageLoading = canManage && (catalogQuery.isLoading || !draft);
  const busy = save.isPending;
  const publicEventsFlagKey = (chrome.public_events_flag_key || "").trim();
  const publicRatedFlagKey = (chrome.public_rated_flag_key || "").trim();
  const prizePoolDisplayFlagKey = (chrome.prize_pool_display_flag_key || "").trim();
  const prizePoolGuaranteeFlagKey = (chrome.prize_pool_guarantee_flag_key || "").trim();
  const kycAutoApproveFlagKey = (chrome.kyc_auto_approve_flag_key || "").trim();
  const publicEnabled = flagsQuery.data?.publicEventsEnabled === true;
  const publicRatedEnabled = flagsQuery.data?.publicEventMatchesRated === true;
  const prizePoolDisplayEnabled = flagsQuery.data?.prizePoolDisplayEnabled === true;
  const prizePoolGuaranteeEnabled = flagsQuery.data?.prizePoolGuaranteeEnabled === true;
  const kycAutoApproveEnabled = flagsQuery.data?.kycAutoApprove === true;
  const flagBusy =
    setFlag.isPending &&
    Boolean(setFlag.variables?.key) &&
    (setFlag.variables?.key === publicEventsFlagKey ||
      setFlag.variables?.key === publicRatedFlagKey ||
      setFlag.variables?.key === prizePoolDisplayFlagKey ||
      setFlag.variables?.key === prizePoolGuaranteeFlagKey ||
      setFlag.variables?.key === kycAutoApproveFlagKey);

  const updateFormat = (id: string, patch: Partial<EventsCatalogFormat>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        formats: prev.formats.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      };
    });
  };

  const updateMinPlayers = (formatId: string, value: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        min_players_to_start: { ...prev.min_players_to_start, [formatId]: value },
      };
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{chrome.page_title}</h1>
        <p className="mt-1 text-sm text-[var(--dama-muted)]">{chrome.page_blurb}</p>
      </div>

      <div
        role="tablist"
        aria-label={(chrome.page_title || "").trim() || undefined}
        className="flex max-w-full flex-wrap gap-1 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-surface)] p-1"
      >
        {(
          [
            ...(canManage
              ? [
                  { id: "hosted" as const, label: (chrome.hosted_events_title || "").trim() },
                  {
                    id: "flags" as const,
                    label: (chrome.public_events_flag_label || "").trim(),
                  },
                ]
              : []),
            ...(canManageReports
              ? [{ id: "reports" as const, label: (chrome.reports_title || "").trim() }]
              : []),
            ...(canManage
              ? [
                  { id: "catalog" as const, label: (chrome.formats_title || "").trim() },
                  { id: "sizes" as const, label: (chrome.sizes_title || "").trim() },
                ]
              : []),
          ] as const
        )
          .filter((t) => Boolean(t.label))
          .map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t.id
                  ? "bg-[var(--dama-card)] text-[var(--dama-fg)] shadow-sm"
                  : "text-[var(--dama-muted)] hover:text-[var(--dama-fg)]",
              )}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
      </div>

      {tab === "hosted" && canManage ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--dama-muted)]">
              {chrome.hosted_events_title}
            </h2>
            <p className="mt-1 text-sm text-[var(--dama-muted)]">{chrome.hosted_events_blurb}</p>
          </div>
          <AdminFilterBar
            filters={[
              {
                kind: "search",
                id: "console-hosted-events-search",
                label: (chrome.search_label || "").trim(),
                placeholder: (chrome.search_placeholder || "").trim(),
                value: hostedSearchDraft,
                onChange: setHostedSearchDraft,
              },
              {
                kind: "select",
                id: "console-hosted-events-entry",
                label: (chrome.filter_entry_label || "").trim(),
                value: hostedEntryFilter === "all" ? "" : hostedEntryFilter,
                onChange: (v) => setHostedEntryFilter((v || "all") as ConsoleEventEntryFilter),
                allLabel: (chrome.filter_all_label || "").trim() || undefined,
                options: [
                  { value: "free", label: (chrome.filter_free_label || "").trim() },
                  { value: "paid", label: (chrome.filter_paid_label || "").trim() },
                ].filter((o) => Boolean(o.label)),
              },
            ]}
          />
          {hostedEventsQuery.isLoading ? (
            <OpsDataTableSkeleton columns={9} rows={5} showSelection />
          ) : hostedEventsQuery.error ? (
            <p className="text-sm text-[var(--dama-danger)]">{chrome.load_failed}</p>
          ) : hostedDisplayRows.length === 0 ? (
            <p className="text-sm text-[var(--dama-muted)]">{chrome.hosted_events_empty}</p>
          ) : (
            <OpsDataTable
              columns={hostedColumns}
              data={hostedDisplayRows}
              getRowId={(row) => row.id}
              bodyRowClassName={(row) =>
                focusEventId && row.id === focusEventId
                  ? "bg-[var(--dama-gold)]/10 ring-1 ring-inset ring-[var(--dama-gold)]"
                  : undefined
              }
              meta={hostedEventsQuery.data?.meta ?? null}
              onPage={setHostedSkip}
              pageInputId="console-hosted-events-skip"
              empty={
                <p className="p-4 text-sm text-[var(--dama-muted)]">{chrome.hosted_events_empty}</p>
              }
              selection={{
                chrome: {
                  selectAllLabel: (chrome.select_all_label || "").trim(),
                  selectRowLabel: (chrome.select_row_label || "").trim(),
                  selectedCountFmt: (chrome.selected_count_fmt || "").trim(),
                },
                rowSelection: hostedRowSelection,
                onRowSelectionChange: setHostedRowSelection,
                toolbar: (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={selectedRowIds(hostedRowSelection).length === 0}
                      onClick={() => setHostedRowSelection({})}
                    >
                      {(chrome.clear_selection_action || "").trim()}
                    </Button>
                  </div>
                ),
              }}
            />
          )}
        </section>
      ) : null}

      {tab === "flags" && canManage ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex h-full flex-wrap items-start justify-between gap-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
            <div className="min-w-0 flex-1 basis-48">
              <p className="font-medium">{chrome.public_events_flag_label}</p>
              <p className="mt-1 text-sm text-[var(--dama-muted)]">
                {chrome.public_events_flag_blurb}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 pt-1">
              <Checkbox
                id="events-public-flag"
                checked={publicEnabled}
                disabled={
                  !isAdmin ||
                  !publicEventsFlagKey ||
                  setFlag.isPending ||
                  flagsQuery.isLoading ||
                  flagBusy
                }
                onCheckedChange={(v) => {
                  if (!publicEventsFlagKey) return;
                  setFlag.mutate({
                    key: publicEventsFlagKey,
                    enabled: v === true,
                  });
                }}
              />
              <label htmlFor="events-public-flag" className="text-sm text-[var(--dama-muted)]">
                {chrome.enabled_label}
              </label>
            </div>
          </div>
          {chrome.public_rated_flag_label ? (
            <div className="flex h-full flex-wrap items-start justify-between gap-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
              <div className="min-w-0 flex-1 basis-48">
                <p className="font-medium">{chrome.public_rated_flag_label}</p>
                <p className="mt-1 text-sm text-[var(--dama-muted)]">
                  {chrome.public_rated_flag_blurb}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 pt-1">
                <Checkbox
                  id="events-public-rated-flag"
                  checked={publicRatedEnabled}
                  disabled={
                    !isAdmin ||
                    !publicRatedFlagKey ||
                    setFlag.isPending ||
                    flagsQuery.isLoading ||
                    flagBusy
                  }
                  onCheckedChange={(v) => {
                    if (!publicRatedFlagKey) return;
                    setFlag.mutate({
                      key: publicRatedFlagKey,
                      enabled: v === true,
                    });
                  }}
                />
                <label
                  htmlFor="events-public-rated-flag"
                  className="text-sm text-[var(--dama-muted)]"
                >
                  {chrome.enabled_label}
                </label>
              </div>
            </div>
          ) : null}
          <div className="flex h-full flex-wrap items-start justify-between gap-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
            <div className="min-w-0 flex-1 basis-48">
              <p className="font-medium">{chrome.prize_pool_display_flag_label}</p>
              <p className="mt-1 text-sm text-[var(--dama-muted)]">
                {chrome.prize_pool_display_flag_blurb}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 pt-1">
              <Checkbox
                id="events-prize-pool-display-flag"
                checked={prizePoolDisplayEnabled}
                disabled={
                  !isAdmin ||
                  !prizePoolDisplayFlagKey ||
                  setFlag.isPending ||
                  flagsQuery.isLoading ||
                  flagBusy
                }
                onCheckedChange={(v) => {
                  if (!prizePoolDisplayFlagKey) return;
                  setFlag.mutate({
                    key: prizePoolDisplayFlagKey,
                    enabled: v === true,
                  });
                }}
              />
              <label
                htmlFor="events-prize-pool-display-flag"
                className="text-sm text-[var(--dama-muted)]"
              >
                {chrome.enabled_label}
              </label>
            </div>
          </div>
          <div className="flex h-full flex-wrap items-start justify-between gap-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
            <div className="min-w-0 flex-1 basis-48">
              <p className="font-medium">{chrome.prize_pool_guarantee_flag_label}</p>
              <p className="mt-1 text-sm text-[var(--dama-muted)]">
                {chrome.prize_pool_guarantee_flag_blurb}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 pt-1">
              <Checkbox
                id="events-prize-pool-guarantee-flag"
                checked={prizePoolGuaranteeEnabled}
                disabled={
                  !isAdmin ||
                  !prizePoolGuaranteeFlagKey ||
                  setFlag.isPending ||
                  flagsQuery.isLoading ||
                  flagBusy
                }
                onCheckedChange={(v) => {
                  if (!prizePoolGuaranteeFlagKey) return;
                  setFlag.mutate({
                    key: prizePoolGuaranteeFlagKey,
                    enabled: v === true,
                  });
                }}
              />
              <label
                htmlFor="events-prize-pool-guarantee-flag"
                className="text-sm text-[var(--dama-muted)]"
              >
                {chrome.enabled_label}
              </label>
            </div>
          </div>
          <div className="flex h-full flex-wrap items-start justify-between gap-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
            <div className="min-w-0 flex-1 basis-48">
              <p className="font-medium">{chrome.kyc_auto_approve_flag_label}</p>
              <p className="mt-1 text-sm text-[var(--dama-muted)]">
                {chrome.kyc_auto_approve_flag_blurb}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 pt-1">
              <Checkbox
                id="events-kyc-auto-approve-flag"
                checked={kycAutoApproveEnabled}
                disabled={
                  !isAdmin ||
                  !kycAutoApproveFlagKey ||
                  setFlag.isPending ||
                  flagsQuery.isLoading ||
                  flagBusy
                }
                onCheckedChange={(v) => {
                  if (!kycAutoApproveFlagKey) return;
                  setFlag.mutate({
                    key: kycAutoApproveFlagKey,
                    enabled: v === true,
                  });
                }}
              />
              <label
                htmlFor="events-kyc-auto-approve-flag"
                className="text-sm text-[var(--dama-muted)]"
              >
                {chrome.enabled_label}
              </label>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "reports" && canManageReports ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--dama-muted)]">
              {chrome.reports_title}
            </h2>
            <p className="mt-1 text-sm text-[var(--dama-muted)]">{chrome.reports_blurb}</p>
          </div>
          {reportsQuery.isLoading ? (
            <OpsDataTableSkeleton columns={5} rows={5} showSelection />
          ) : reportsQuery.error ? (
            <p className="text-sm text-[var(--dama-danger)]">{chrome.load_failed}</p>
          ) : (reportsQuery.data?.reports.length ?? 0) === 0 ? (
            <p className="text-sm text-[var(--dama-muted)]">{chrome.reports_empty}</p>
          ) : (
            <OpsDataTable
              columns={reportsColumns}
              data={reportsQuery.data?.reports ?? []}
              getRowId={(row) => row.id}
              isFetching={reportsQuery.isFetching && !reportsQuery.isLoading}
              bodyRowClassName={(row) =>
                focusReportId && row.id === focusReportId
                  ? "bg-[var(--dama-gold)]/10 ring-1 ring-inset ring-[var(--dama-gold)]"
                  : undefined
              }
              meta={reportsQuery.data?.meta ?? null}
              onPage={(next) => {
                setReportsSkip(next);
                setReportsRowSelection({});
              }}
              pageInputId="console-event-reports-skip"
              pageDisabled={
                (reportsQuery.isFetching && !reportsQuery.isLoading) || reportsBulkPending
              }
              empty={<p className="p-4 text-sm text-[var(--dama-muted)]">{chrome.reports_empty}</p>}
              selection={{
                chrome: {
                  selectAllLabel: (chrome.select_all_label || "").trim(),
                  selectRowLabel: (chrome.select_row_label || "").trim(),
                  selectedCountFmt: (chrome.selected_count_fmt || "").trim(),
                },
                rowSelection: reportsRowSelection,
                onRowSelectionChange: setReportsRowSelection,
                toolbar: (
                  <div className="flex flex-wrap gap-2">
                    {(chrome.dismiss_action || "").trim() ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          selectedRowIds(reportsRowSelection).length === 0 || reportsBulkPending
                        }
                        isLoading={reportsBulkPending}
                        pendingLabel={(chrome.save_pending || "").trim()}
                        onClick={() => void bulkEventReports("dismiss")}
                      >
                        {(chrome.dismiss_action || "").trim()}
                      </Button>
                    ) : null}
                    {(chrome.deactivate_action || "").trim() ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={
                          selectedRowIds(reportsRowSelection).length === 0 || reportsBulkPending
                        }
                        isLoading={reportsBulkPending}
                        pendingLabel={(chrome.save_pending || "").trim()}
                        onClick={() => void bulkEventReports("deactivate")}
                      >
                        {(chrome.deactivate_action || "").trim()}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reportsBulkPending}
                      onClick={() => setReportsRowSelection({})}
                    >
                      {(chrome.clear_selection_action || "").trim()}
                    </Button>
                  </div>
                ),
              }}
            />
          )}
        </section>
      ) : null}

      {chrome ? (
        <Dialog open={detailEventDialog.open} onOpenChange={detailEventDialog.onOpenChange}>
          <DialogContent closeLabel={chrome.detail_close_label} className="max-w-2xl sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{chrome.detail_modal_title}</DialogTitle>
              <DialogDescription className="sr-only">{chrome.detail_modal_title}</DialogDescription>
            </DialogHeader>
            {detailEvent ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailRow
                  label={chrome.hosted_col_title}
                  value={(detailEvent.title || "").trim() || chrome.empty_value}
                />
                {(detailEvent.description || "").trim() ? (
                  <div className="min-w-0 sm:col-span-2">
                    {(chrome.detail_description_label || "").trim() ? (
                      <p className="text-xs text-[var(--dama-muted)]">
                        {(chrome.detail_description_label || "").trim()}
                      </p>
                    ) : null}
                    <p className="whitespace-pre-wrap break-words text-sm font-medium">
                      {(detailEvent.description || "").trim()}
                    </p>
                  </div>
                ) : null}
                <DetailRow
                  label={chrome.hosted_col_status}
                  value={(detailEvent.status_label || "").trim() || chrome.empty_value}
                />
                <DetailRow
                  label={chrome.hosted_col_entry}
                  value={
                    detailEvent.is_free_entry === true
                      ? chrome.filter_free_label
                      : detailEvent.is_free_entry === false
                        ? chrome.filter_paid_label
                        : chrome.empty_value
                  }
                />
                <DetailRow
                  label={chrome.hosted_col_visibility}
                  value={(detailEvent.visibility_label || "").trim() || chrome.empty_value}
                />
                <div className="min-w-0">
                  {(chrome.hosted_col_organizer || "").trim() ? (
                    <p className="text-xs text-[var(--dama-muted)]">
                      {(chrome.hosted_col_organizer || "").trim()}
                    </p>
                  ) : null}
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="break-words text-sm font-medium">
                      {(detailEvent.organizer_username || "").trim() || chrome.empty_value}
                    </span>
                    <HostTrustBadge
                      label={detailEvent.organizer_host_trust_badge}
                      tier={detailEvent.organizer_host_trust_tier}
                      className="shrink-0"
                    />
                  </div>
                  {(() => {
                    const rep = hostReputationLine({
                      finished: detailEvent.organizer_finished_paid_cups,
                      cancelled: detailEvent.organizer_cancelled_paid_cups,
                      openReports: detailEvent.organizer_open_reports,
                      finishedLabel: chrome.host_rep_finished_label,
                      cancelledLabel: chrome.host_rep_cancelled_label,
                      reportsLabel: chrome.host_rep_reports_label,
                      separator: chrome.host_rep_meta_separator,
                    });
                    return rep ? (
                      <p
                        className="mt-0.5 truncate text-[10px] text-[var(--dama-muted)]"
                        title={rep}
                      >
                        {rep}
                      </p>
                    ) : null;
                  })()}
                </div>
                <DetailRow
                  label={chrome.hosted_col_code}
                  value={(detailEvent.join_code || "").trim() || chrome.empty_value}
                />
                <DetailRow
                  label={chrome.detail_format_label}
                  value={(detailEvent.format_label || "").trim() || chrome.empty_value}
                />
                <DetailRow
                  label={chrome.detail_size_label}
                  value={(detailEvent.size_label || "").trim() || chrome.empty_value}
                />
                <DetailRow
                  label={chrome.hosted_col_players}
                  value={(() => {
                    const empty = (chrome.empty_value || "").trim();
                    const left =
                      typeof detailEvent.approved_count === "number"
                        ? String(detailEvent.approved_count)
                        : empty;
                    const right = formatSeatCapDisplay(
                      detailEvent.max_players,
                      swissRoundsByMax,
                      chrome.unlimited_players_label || "",
                      empty,
                    );
                    return `${left}/${right}`;
                  })()}
                />
                <DetailRow
                  label={chrome.detail_pending_players_label}
                  value={
                    typeof detailEvent.pending_count === "number"
                      ? String(detailEvent.pending_count)
                      : chrome.empty_value
                  }
                />
                <DetailRow
                  label={chrome.detail_entry_fee_label}
                  value={
                    detailEvent.is_free_entry === true
                      ? chrome.filter_free_label
                      : formatMoney(
                          detailEvent.entry_fee_amount,
                          detailEvent.entry_fee_currency,
                          chrome.amount_currency_separator,
                          chrome.empty_value,
                        )
                  }
                />
                <DetailRow
                  label={chrome.detail_host_fee_label}
                  value={formatMoney(
                    detailEvent.host_fee_amount,
                    detailEvent.host_fee_currency,
                    chrome.amount_currency_separator,
                    chrome.empty_value,
                  )}
                />
                <DetailRow
                  label={chrome.detail_commission_label}
                  value={
                    typeof detailEvent.entry_fee_commission_percent === "number"
                      ? String(detailEvent.entry_fee_commission_percent)
                      : chrome.empty_value
                  }
                />
                <DetailRow
                  label={chrome.detail_auto_approve_label}
                  value={
                    detailEvent.auto_approve === true
                      ? chrome.detail_yes
                      : detailEvent.auto_approve === false
                        ? chrome.detail_no
                        : chrome.empty_value
                  }
                />
                <DetailRow
                  label={chrome.hosted_col_created}
                  value={formatDay(detailEvent.created_at, chrome.empty_value)}
                />
                <DetailRow
                  label={chrome.detail_updated_label}
                  value={formatDay(detailEvent.updated_at, chrome.empty_value)}
                />
                <DetailRow
                  label={chrome.detail_started_label}
                  value={formatDay(detailEvent.started_at, chrome.empty_value)}
                />
                <DetailRow
                  label={chrome.detail_finished_label}
                  value={formatDay(detailEvent.finished_at, chrome.empty_value)}
                />
                <DetailRow
                  label={chrome.detail_cancelled_label}
                  value={formatDay(detailEvent.cancelled_at, chrome.empty_value)}
                />
                {detailEvent.prize_pool_display_enabled ? (
                  <>
                    <DetailRow
                      label={chrome.detail_prize_now_label}
                      value={formatMoney(
                        detailEvent.prize_pool_now,
                        detailEvent.prize_pool_currency,
                        chrome.amount_currency_separator,
                        chrome.empty_value,
                      )}
                    />
                    <DetailRow
                      label={chrome.detail_prize_if_full_label}
                      value={formatMoney(
                        detailEvent.prize_pool_if_full,
                        detailEvent.prize_pool_currency,
                        chrome.amount_currency_separator,
                        chrome.empty_value,
                      )}
                    />
                    {detailEvent.prize_pool_guarantee_held ? (
                      <DetailRow
                        label={chrome.detail_prize_guarantee_label}
                        value={formatMoney(
                          detailEvent.prize_pool_guarantee_amount,
                          detailEvent.prize_pool_currency,
                          chrome.amount_currency_separator,
                          chrome.empty_value,
                        )}
                      />
                    ) : null}
                    <DetailRow
                      label={chrome.detail_prize_frozen_label}
                      value={
                        detailEvent.prize_pool_frozen === true
                          ? chrome.detail_yes
                          : detailEvent.prize_pool_frozen === false
                            ? chrome.detail_no
                            : chrome.empty_value
                      }
                    />
                  </>
                ) : null}
                {(detailEvent.brand_color || "").trim() ? (
                  <DetailRow
                    label={chrome.detail_brand_color_label}
                    value={(detailEvent.brand_color || "").trim()}
                  />
                ) : null}
                {(detailEvent.winner_username || "").trim() ? (
                  <DetailRow
                    label={chrome.detail_winner_label}
                    value={(detailEvent.winner_username || "").trim()}
                  />
                ) : null}
                {detailEvent.prize_pool_guarantee_enabled != null ? (
                  <DetailRow
                    label={chrome.prize_pool_guarantee_flag_label}
                    value={
                      detailEvent.prize_pool_guarantee_enabled
                        ? chrome.detail_yes
                        : chrome.detail_no
                    }
                  />
                ) : null}
                {(detailEvent.sponsor_name || "").trim() ? (
                  <DetailRow
                    label={chrome.detail_sponsor_label}
                    value={(detailEvent.sponsor_name || "").trim()}
                  />
                ) : null}
                {(detailEvent.share_url || "").trim() ? (
                  <div className="min-w-0 sm:col-span-2">
                    <p className="text-xs text-[var(--dama-muted)]">{chrome.detail_share_label}</p>
                    <a
                      href={(detailEvent.share_url || "").trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-sm font-medium text-[var(--dama-gold)] underline-offset-2 hover:underline"
                    >
                      {(detailEvent.share_url || "").trim()}
                    </a>
                  </div>
                ) : null}
                {(() => {
                  const prizeLabel = (chrome.detail_prize_image_label || "").trim();
                  const prizeSrc = resolvePublicMediaUrl(detailEvent.prize_image_url);
                  if (!prizeLabel || !prizeSrc) return null;
                  return (
                    <div className="min-w-0 sm:col-span-2">
                      <p className="text-xs text-[var(--dama-muted)]">{prizeLabel}</p>
                      <MediaProofGallery slides={[{ src: prizeSrc }]} className="mt-2" />
                    </div>
                  );
                })()}
                {(() => {
                  const galleryLabel = (chrome.detail_gallery_label || "").trim();
                  if (!galleryLabel) return null;
                  const galleryUrls = (detailEvent.gallery ?? [])
                    .map((u) => resolvePublicMediaUrl(u))
                    .filter(Boolean);
                  return (
                    <div className="min-w-0 sm:col-span-2">
                      <p className="text-xs text-[var(--dama-muted)]">{galleryLabel}</p>
                      {galleryUrls.length > 0 ? (
                        <GalleryCarousel
                          images={galleryUrls}
                          ariaLabel={galleryLabel}
                          className="relative mt-2 aspect-[16/10] w-full max-w-md overflow-hidden rounded-lg bg-[var(--dama-surface)]"
                        />
                      ) : (
                        <p className="mt-1 text-sm text-[var(--dama-muted)]">
                          {(chrome.gallery_empty || "").trim()}
                        </p>
                      )}
                    </div>
                  );
                })()}
                {(() => {
                  const logoSrc = resolvePublicMediaUrl(detailEvent.logo_url);
                  const sponsorSrc = resolvePublicMediaUrl(detailEvent.sponsor_logo_url);
                  const slides = [
                    ...(logoSrc
                      ? [{ src: logoSrc, caption: (chrome.detail_logo_label || "").trim() }]
                      : []),
                    ...(sponsorSrc
                      ? [
                          {
                            src: sponsorSrc,
                            caption: (chrome.detail_sponsor_logo_label || "").trim(),
                          },
                        ]
                      : []),
                  ];
                  return slides.length > 0 ? (
                    <div className="min-w-0 sm:col-span-2">
                      <MediaProofGallery slides={slides} />
                    </div>
                  ) : null;
                })()}
              </div>
            ) : null}
            {detailEvent && (chrome.detail_players_section_title || "").trim() ? (
              <div className="mt-4 space-y-2 border-t border-[var(--dama-border)] pt-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-[var(--dama-text)]">
                    {(chrome.detail_players_section_title || "").trim()}
                  </p>
                  {(chrome.detail_players_section_blurb || "").trim() ? (
                    <p className="text-xs text-[var(--dama-muted)]">
                      {(chrome.detail_players_section_blurb || "").trim()}
                    </p>
                  ) : null}
                </div>
                {detailEntriesQuery.isLoading ? (
                  <OpsDataTableSkeleton columns={5} rows={4} />
                ) : detailEntries.length === 0 ? (
                  <p className="text-sm text-[var(--dama-muted)]">
                    {(chrome.detail_players_empty || "").trim() || chrome.empty_value}
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[520px] text-left text-xs">
                        <thead>
                          <tr className="border-b border-[var(--dama-border)] text-[var(--dama-muted)]">
                            {(chrome.detail_players_col_user || "").trim() ? (
                              <th className="py-2 pr-2 font-medium">
                                {(chrome.detail_players_col_user || "").trim()}
                              </th>
                            ) : null}
                            {(chrome.detail_players_col_status || "").trim() ? (
                              <th className="py-2 pr-2 font-medium">
                                {(chrome.detail_players_col_status || "").trim()}
                              </th>
                            ) : null}
                            {(chrome.detail_players_col_checked_in || "").trim() ? (
                              <th className="py-2 pr-2 font-medium">
                                {(chrome.detail_players_col_checked_in || "").trim()}
                              </th>
                            ) : null}
                            {(chrome.detail_players_col_placement || "").trim() ? (
                              <th className="py-2 pr-2 font-medium">
                                {(chrome.detail_players_col_placement || "").trim()}
                              </th>
                            ) : null}
                            {(chrome.detail_players_col_rating || "").trim() ? (
                              <th className="py-2 pr-2 font-medium">
                                {(chrome.detail_players_col_rating || "").trim()}
                              </th>
                            ) : null}
                            {(chrome.detail_players_open_user || "").trim() ? (
                              <th className="py-2 font-medium">
                                {(chrome.detail_players_open_user || "").trim()}
                              </th>
                            ) : null}
                          </tr>
                        </thead>
                        <tbody>
                          {detailEntries.map((en) => (
                            <tr
                              key={en.id}
                              className="border-b border-[var(--dama-border)] text-[var(--dama-text)]"
                            >
                              {(chrome.detail_players_col_user || "").trim() ? (
                                <td className="py-2 pr-2 font-medium">
                                  {(en.username || "").trim() || chrome.empty_value}
                                </td>
                              ) : null}
                              {(chrome.detail_players_col_status || "").trim() ? (
                                <td className="py-2 pr-2">
                                  {(en.status_label || en.status || "").trim() ||
                                    chrome.empty_value}
                                </td>
                              ) : null}
                              {(chrome.detail_players_col_checked_in || "").trim() ? (
                                <td className="py-2 pr-2">
                                  {(en.checked_in_at || "").trim()
                                    ? chrome.detail_yes
                                    : chrome.detail_no}
                                </td>
                              ) : null}
                              {(chrome.detail_players_col_placement || "").trim() ? (
                                <td className="py-2 pr-2">
                                  {typeof en.placement === "number"
                                    ? String(en.placement)
                                    : chrome.empty_value}
                                </td>
                              ) : null}
                              {(chrome.detail_players_col_rating || "").trim() ? (
                                <td className="py-2 pr-2">
                                  {typeof en.rating === "number"
                                    ? String(en.rating)
                                    : chrome.empty_value}
                                </td>
                              ) : null}
                              {(chrome.detail_players_open_user || "").trim() &&
                              (en.user_id || "").trim() ? (
                                <td className="py-2">
                                  <a
                                    href={`/users/${encodeURIComponent(en.user_id)}`}
                                    className="text-[var(--dama-gold)] underline-offset-2 hover:underline"
                                  >
                                    {(chrome.detail_players_open_user || "").trim()}
                                  </a>
                                </td>
                              ) : null}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {detailEntriesMeta ? (
                      <SkipPagination
                        meta={detailEntriesMeta}
                        onPrev={setDetailEntriesSkip}
                        onNext={setDetailEntriesSkip}
                        disabled={detailEntriesQuery.isFetching && !detailEntriesQuery.isLoading}
                        inputId="admin-event-detail-players-skip"
                      />
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => detailEventDialog.close()}>
                {chrome.detail_close_label}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {chrome && canManageReports ? (
        <Dialog open={detailReportDialog.open} onOpenChange={detailReportDialog.onOpenChange}>
          <DialogContent closeLabel={chrome.detail_close_label} className="max-w-2xl sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{chrome.detail_modal_title}</DialogTitle>
              <DialogDescription className="sr-only">{chrome.detail_modal_title}</DialogDescription>
            </DialogHeader>
            {detailReport ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <p className="text-xs text-[var(--dama-muted)]">{chrome.report_event_col}</p>
                  <p className="break-words text-sm font-medium">
                    {(detailReport.event_title || "").trim() || chrome.empty_value}
                  </p>
                  {detailReport.event_join_code ? (
                    <p className="font-mono text-xs text-[var(--dama-muted)]">
                      {detailReport.event_join_code}
                    </p>
                  ) : null}
                </div>
                <DetailRow
                  label={chrome.report_reporter_col}
                  value={(detailReport.reporter_username || "").trim() || chrome.empty_value}
                />
                <div className="min-w-0 sm:col-span-2">
                  <p className="text-xs text-[var(--dama-muted)]">{chrome.report_reason_col}</p>
                  <p className="break-words text-sm font-medium">
                    {(detailReport.reason_label || "").trim() || chrome.empty_value}
                  </p>
                  {detailReport.note.trim() ? (
                    <p className="mt-1 break-words text-xs text-[var(--dama-muted)]">
                      {detailReport.note}
                    </p>
                  ) : null}
                </div>
                <DetailRow
                  label={chrome.report_status_col}
                  value={
                    (reportStatusLabels[detailReport.status] || "").trim() || chrome.empty_value
                  }
                />
                <DetailRow
                  label={chrome.hosted_col_created}
                  value={formatDay(detailReport.created_at, chrome.empty_value)}
                />
              </div>
            ) : null}
            <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {detailReport ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={dismissReport.isPending || deactivateReport.isPending}
                      isLoading={
                        dismissReport.isPending && dismissReport.variables === detailReport.id
                      }
                      pendingLabel={chrome.save_pending}
                      onClick={() => dismissReport.mutate(detailReport.id)}
                    >
                      {chrome.dismiss_action}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="text-[var(--dama-danger)]"
                      disabled={dismissReport.isPending || deactivateReport.isPending}
                      isLoading={
                        deactivateReport.isPending && deactivateReport.variables === detailReport.id
                      }
                      pendingLabel={chrome.save_pending}
                      onClick={() => deactivateReport.mutate(detailReport.id)}
                    >
                      {chrome.deactivate_action}
                    </Button>
                  </>
                ) : null}
              </div>
              <Button type="button" variant="outline" onClick={() => detailReportDialog.close()}>
                {chrome.detail_close_label}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {tab === "catalog" && canManage ? (
        pageLoading ? (
          <div className="space-y-4">
            <FormCardSkeleton />
            <FormCardSkeleton />
          </div>
        ) : catalogQuery.error || !draft ? (
          <p className="text-sm text-[var(--dama-danger)]">{chrome.load_failed}</p>
        ) : (
          <>
            <div className="space-y-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="events-join-code-length" label={chrome.join_code_length_label}>
                  <Input
                    id="events-join-code-length"
                    type="number"
                    min={4}
                    max={16}
                    value={draft.join_code_length}
                    onChange={(e) => {
                      const digits = sanitizeIntegerInput(e.target.value);
                      setDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              join_code_length:
                                digits === "" ? prev.join_code_length : Number(digits),
                            }
                          : prev,
                      );
                    }}
                    inputMode="numeric"
                    disabled={busy}
                  />
                </Field>
                {draft.force_auto_approve && (chrome.force_auto_approve_note || "").trim() ? (
                  <Field
                    id="events-force-auto-approve"
                    label={chrome.auto_approve_default_label}
                    className="sm:col-span-2"
                  >
                    <p className="pt-2 text-sm text-[var(--dama-muted)]">
                      {chrome.force_auto_approve_note}
                    </p>
                  </Field>
                ) : (
                  <Field id="events-auto-approve" label={chrome.auto_approve_default_label}>
                    <div className="flex min-h-10 items-center gap-2 pt-1">
                      <Checkbox
                        id="events-auto-approve"
                        checked={draft.auto_approve_default}
                        onCheckedChange={(v) =>
                          setDraft((prev) =>
                            prev ? { ...prev, auto_approve_default: v === true } : prev,
                          )
                        }
                        disabled={busy}
                      />
                    </div>
                  </Field>
                )}
                <Field
                  id="events-entry-commission"
                  label={chrome.entry_fee_commission_label}
                  className="sm:col-span-2"
                >
                  <AmountInput
                    id="events-entry-commission"
                    value={String(draft.entry_fee_commission_percent ?? "")}
                    onValueChange={(next) => {
                      setDraft((prev) => {
                        if (!prev) return prev;
                        if (next === "") return prev;
                        const n = Number(next);
                        if (!Number.isFinite(n)) return prev;
                        const clamped = Math.min(100, Math.max(0, n));
                        return { ...prev, entry_fee_commission_percent: clamped };
                      });
                    }}
                    disabled={busy}
                    maxDecimals={2}
                  />
                  <p className="mt-1 text-xs text-[var(--dama-muted)]">
                    {chrome.entry_fee_commission_blurb}
                  </p>
                </Field>
                <Field
                  id="events-public-host-mult"
                  label={chrome.public_host_fee_multiplier_label}
                  className="sm:col-span-2"
                >
                  <AmountInput
                    id="events-public-host-mult"
                    value={String(draft.public_host_fee_multiplier ?? "")}
                    onValueChange={(next) => {
                      setDraft((prev) => {
                        if (!prev) return prev;
                        if (next === "") return prev;
                        const n = Number(next);
                        if (!Number.isFinite(n) || !(n > 0)) return prev;
                        return { ...prev, public_host_fee_multiplier: n };
                      });
                    }}
                    disabled={busy}
                    maxDecimals={4}
                  />
                  <p className="mt-1 text-xs text-[var(--dama-muted)]">
                    {chrome.public_host_fee_multiplier_blurb}
                  </p>
                </Field>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
              <h2 className="font-semibold text-[var(--dama-gold)]">
                {chrome.report_reasons_title}
              </h2>
              <p className="text-sm text-[var(--dama-muted)]">{chrome.report_reasons_blurb}</p>
              <ul className="space-y-3">
                {draft.report_reason_codes.map((code) => (
                  <li
                    key={code}
                    className="space-y-3 border-b border-[var(--dama-border)] pb-3 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="text-xs text-[var(--dama-muted)]">
                        {chrome.report_reason_code_label}
                      </p>
                      <p className="font-mono text-sm">{code}</p>
                    </div>
                    <Field
                      id={`events-report-reason-label-${code}`}
                      label={chrome.catalog_item_label}
                    >
                      <Input
                        id={`events-report-reason-label-${code}`}
                        value={draft.report_reason_labels?.[code] ?? ""}
                        onChange={(e) => {
                          const next = e.target.value;
                          setDraft((prev) => {
                            if (!prev) return prev;
                            return {
                              ...prev,
                              report_reason_labels: {
                                ...(prev.report_reason_labels ?? {}),
                                [code]: next,
                              },
                            };
                          });
                        }}
                        disabled={busy}
                        autoComplete="off"
                      />
                      <p className="mt-1 text-xs text-[var(--dama-muted)]">
                        {chrome.catalog_item_label_blurb}
                      </p>
                    </Field>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
              <h2 className="font-semibold text-[var(--dama-gold)]">{chrome.formats_title}</h2>
              {(chrome.formats_engine_blurb || "").trim() ? (
                <p className="text-sm text-[var(--dama-muted)]">{chrome.formats_engine_blurb}</p>
              ) : null}
              <ul className="space-y-3">
                {draft.formats.map((f) => (
                  <li
                    key={f.id}
                    className="space-y-3 border-b border-[var(--dama-border)] pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-[var(--dama-muted)]">{chrome.format_id_label}</p>
                        <p className="font-mono text-sm">{f.id}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`events-format-enabled-${f.id}`}
                          checked={f.enabled}
                          onCheckedChange={(v) => updateFormat(f.id, { enabled: v === true })}
                          disabled={busy}
                        />
                        <label
                          htmlFor={`events-format-enabled-${f.id}`}
                          className="text-sm text-[var(--dama-muted)]"
                        >
                          {chrome.enabled_label}
                        </label>
                      </div>
                    </div>
                    <Field id={`events-format-label-${f.id}`} label={chrome.catalog_item_label}>
                      <Input
                        id={`events-format-label-${f.id}`}
                        value={f.label}
                        onChange={(e) => updateFormat(f.id, { label: e.target.value })}
                        disabled={busy}
                        autoComplete="off"
                      />
                      <p className="mt-1 text-xs text-[var(--dama-muted)]">
                        {chrome.catalog_item_label_blurb}
                      </p>
                    </Field>
                  </li>
                ))}
              </ul>
              {(chrome.swiss_rounds_label || "").trim() ? (
                <div className="space-y-3 border-t border-[var(--dama-border)] pt-4">
                  <h3 className="text-sm font-semibold text-[var(--dama-gold)]">
                    {chrome.swiss_rounds_label}
                  </h3>
                  <ul className="space-y-3">
                    {Object.keys(draft.swiss_rounds_by_max_players)
                      .sort((a, b) => Number(a) - Number(b))
                      .map((maxKey) => (
                        <li key={`swiss-${maxKey}`} className="grid gap-3 sm:grid-cols-2">
                          <Field id={`events-swiss-max-${maxKey}`} label={chrome.max_players_label}>
                            <Input
                              id={`events-swiss-max-${maxKey}`}
                              type="number"
                              min={2}
                              value={maxKey}
                              onChange={(e) => {
                                const digits = sanitizeIntegerInput(e.target.value);
                                if (digits === "") return;
                                const nextKey = digits;
                                setDraft((prev) => {
                                  if (!prev) return prev;
                                  const next = { ...prev.swiss_rounds_by_max_players };
                                  const rounds = next[maxKey];
                                  if (typeof rounds !== "number") return prev;
                                  delete next[maxKey];
                                  next[nextKey] = rounds;
                                  return { ...prev, swiss_rounds_by_max_players: next };
                                });
                              }}
                              inputMode="numeric"
                              disabled={busy}
                            />
                          </Field>
                          <Field
                            id={`events-swiss-rounds-${maxKey}`}
                            label={chrome.swiss_rounds_label}
                          >
                            <Input
                              id={`events-swiss-rounds-${maxKey}`}
                              type="number"
                              min={1}
                              value={draft.swiss_rounds_by_max_players[maxKey] ?? ""}
                              onChange={(e) => {
                                const digits = sanitizeIntegerInput(e.target.value);
                                if (digits === "") return;
                                setDraft((prev) => {
                                  if (!prev) return prev;
                                  return {
                                    ...prev,
                                    swiss_rounds_by_max_players: {
                                      ...prev.swiss_rounds_by_max_players,
                                      [maxKey]: Number(digits),
                                    },
                                  };
                                });
                              }}
                              inputMode="numeric"
                              disabled={busy}
                            />
                          </Field>
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}
              {(chrome.groups_size_label || "").trim() ||
              (chrome.groups_advance_label || "").trim() ? (
                <div className="grid gap-3 border-t border-[var(--dama-border)] pt-4 sm:grid-cols-2">
                  {(chrome.groups_size_label || "").trim() ? (
                    <Field id="events-groups-size" label={chrome.groups_size_label}>
                      <Input
                        id="events-groups-size"
                        type="number"
                        min={2}
                        value={draft.groups_knockout_target_group_size}
                        onChange={(e) => {
                          const digits = sanitizeIntegerInput(e.target.value);
                          if (digits === "") return;
                          setDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  groups_knockout_target_group_size: Number(digits),
                                }
                              : prev,
                          );
                        }}
                        inputMode="numeric"
                        disabled={busy}
                      />
                    </Field>
                  ) : null}
                  {(chrome.groups_advance_label || "").trim() ? (
                    <Field id="events-groups-advance" label={chrome.groups_advance_label}>
                      <Input
                        id="events-groups-advance"
                        type="number"
                        min={1}
                        value={draft.groups_knockout_advance_per_group}
                        onChange={(e) => {
                          const digits = sanitizeIntegerInput(e.target.value);
                          if (digits === "") return;
                          setDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  groups_knockout_advance_per_group: Number(digits),
                                }
                              : prev,
                          );
                        }}
                        inputMode="numeric"
                        disabled={busy}
                      />
                    </Field>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="space-y-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
              <h2 className="font-semibold text-[var(--dama-gold)]">{chrome.min_players_title}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {draft.formats.map((f) => (
                  <div key={`min-${f.id}`} className="space-y-1">
                    <p className="text-sm text-[var(--dama-text)]">{(f.label || "").trim()}</p>
                    <p className="font-mono text-xs text-[var(--dama-muted)]">{f.id}</p>
                    <Field id={`events-min-players-${f.id}`} label={chrome.min_players_label}>
                      <Input
                        id={`events-min-players-${f.id}`}
                        type="number"
                        min={2}
                        value={draft.min_players_to_start[f.id] ?? ""}
                        onChange={(e) => {
                          const digits = sanitizeIntegerInput(e.target.value);
                          if (digits === "") return;
                          updateMinPlayers(f.id, Number(digits));
                        }}
                        inputMode="numeric"
                        disabled={busy}
                      />
                    </Field>
                  </div>
                ))}
              </div>
            </div>

            <Button
              variant="gold"
              isLoading={busy}
              pendingLabel={chrome.save_pending}
              disabled={busy}
              onClick={() => {
                if (!draft) return;
                // Host sizes are owned by DataTable CRUD APIs. Server CatalogPut preserves DB sizes;
                // client must not send a stale sizes array that could race with size edits.
                const { sizes: _sizesOmit, ...rest } = draft;
                save.mutate(cloneCatalog({ ...rest, sizes: [] }));
              }}
            >
              {chrome.save_action}
            </Button>
          </>
        )
      ) : null}

      {tab === "sizes" && canManage ? (
        pageLoading || !draft ? (
          <FormCardSkeleton />
        ) : (
          <HostSizesCatalogSection
            token={token}
            chrome={chrome}
            formats={draft.formats}
            swissRoundsByMaxPlayers={draft.swiss_rounds_by_max_players || {}}
            arenaFormatId={(enumsQuery.data?.hosted_event_arena_format || "").trim()}
            canManage={canManage}
          />
        )
      ) : null}
    </div>
  );
}
