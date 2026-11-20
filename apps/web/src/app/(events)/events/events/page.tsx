"use client";

import { SignInLink } from "@/components/auth/SignInLink";
import { ManageEventDialog } from "@/components/events/ManageEventDialog";
import { HostTrustBadge } from "@/components/trust/HostTrustBadge";
import { hostReputationLine } from "@/lib/host-reputation-line";
import { ArenaDurationField } from "@/components/tournaments/ArenaDurationField";
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
  type OpsRowSelectionState,
  OpsDataTable,
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
import { EventsListSkeleton, OpsDataTableSkeleton } from "@/components/ui/shimmer-skeletons";
import { useCheckoutMutation } from "@/hooks/mutation/useCheckoutMutation";
import { useCloseHostedEventMutation } from "@/hooks/mutation/useCloseHostedEventMutation";
import {
  type CreateHostedEventError,
  useCreateHostedEventMutation,
} from "@/hooks/mutation/useCreateHostedEventMutation";
import { useReopenHostedEventMutation } from "@/hooks/mutation/useReopenHostedEventMutation";
import { useCashRmgChromeQuery } from "@/hooks/query/useCashRmgChromeQuery";
import { useClientEnumsQuery } from "@/hooks/query/useClientEnumsQuery";
import { useDetectBrowserCountryQuery } from "@/hooks/query/useDetectBrowserCountryQuery";
import { useEntryFeeQuoteQuery } from "@/hooks/query/useEntryFeeQuoteQuery";
import { useEventsCatalogQuery } from "@/hooks/query/useEventsCatalogQuery";
import {
  type OrganizerEventEntryFilter,
  useEventsListQuery,
} from "@/hooks/query/useEventsListQuery";
import { useEventsOrganizerChromeQuery } from "@/hooks/query/useEventsOrganizerChromeQuery";
import { useMeQuery } from "@/hooks/query/useMeQuery";
import { softCommunityJoinStatusMessage } from "@/lib/community-player-chrome-soft";
import {
  softHostingCancelAction,
  softHostingChromeUnavailable,
  softHostingCloseAction,
  softHostingCreateAction,
  softHostingCreateTitle,
  softHostingCreateBlurb,
  softHostingEmptyList,
  softHostingFeatureDisabled,
  softHostingListBlurb,
  softHostingListTitle,
  softHostingPublicDisabled,
  softHostingReopenAction,
  softHostingSearchLabel,
  softHostingSearchPlaceholder,
  softHostingTitleLabel,
  softHostingVisibilityPrivateBlurb,
  softHostingVisibilityPublicBlurb,
} from "@/lib/hosting-organizer-chrome-soft";
import { usePaymentModalChromeQuery } from "@/hooks/query/usePaymentModalChromeQuery";
import { usePaymentRouteQuery } from "@/hooks/query/usePaymentRouteQuery";
import { useWalletQuery } from "@/hooks/query/useWalletQuery";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDeferredDialogValue } from "@/hooks/use-deferred-dialog-selection";
import { useResetSkipOnChange } from "@/hooks/useResetSkipOnChange";
import { parseDefaultArenaDurationMinutes, tournamentFormatIsArena } from "@/lib/competition-arena";
import {
  buildPlacePercentsPayload,
  defaultPayoutModeForFormat,
  payoutModeOptions,
  placePercentsSumInvalid,
} from "@/lib/competition-payout";
import { useUrlSkip } from "@/hooks/useUrlSkip";
import { restClient } from "@/lib/api";
import { chromeSeparator, chromeSeparatorPresent } from "@/lib/chrome-separator";
import { apiRestUrl } from "@/lib/env";
import { resolveEventInviteShareUrl } from "@/lib/event-invite-share-url";
import { eventsDialogShellStyle } from "@/lib/events-dialog-shell-style";
import {
  resolveHostPreferPublicSeed,
  resolveHostVisibilityAfterCatalog,
} from "@/lib/host-create-visibility";
import { filenameFromContentDisposition } from "@/lib/filename-from-content-disposition";
import {
  hostedEventPrizePoolLines,
  prizePoolCardLabelsFromOrganizer,
} from "@/lib/prize-pool-lines";
import { parsePositiveDecimal, sanitizeDecimalInput } from "@/lib/sanitize-decimal-input";
import { formatSeatCapDisplay, seatCapFillRight } from "@/lib/seat-cap-display";
import { withWalletFocusParam } from "@/lib/wallet-focus-href";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import type { HostedEvent } from "@/types/events";
import { isEventsOrganizerChromeReady } from "@/types/events-organizer-chrome";
import { isPaymentModalChromeReady } from "@/types/payment-modal-chrome";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const STATUS_ALL = "__all__";

function parseListPageSize(raw: string | undefined): number {
  const n = Number.parseInt(String(raw || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export default function EventsListPage() {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const meQuery = useMeQuery(token);
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkId = (searchParams.get("id") || "").trim();
  const wantCreate = (searchParams.get("create") || "").trim() === "1";
  const deepLinkOpened = useRef("");
  const createDeepLinkOpened = useRef(false);
  /** Host CTA create prefers Public so the cup can list under Community. */
  const hostCreatePreferPublic = useRef(false);
  /** Tracks create dialog open edge so prefer-Public clears on dismiss, not on open scheduling. */
  const createDialogWasOpen = useRef(false);
  const createDialog = useDeferredDialogValue<true>();
  const detailDialog = useDeferredDialogValue<HostedEvent>();
  const openDetail = detailDialog.openWith;

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  const [statusFilter, setStatusFilter] = useState(STATUS_ALL);
  const [entryFilter, setEntryFilter] = useState<OrganizerEventEntryFilter>("all");
  // Namespaced so refresh keeps organizer list page (not conflated with other ?skip=).
  const [skip, setSkip] = useUrlSkip("events_list_skip");

  useResetSkipOnChange(setSkip, [debouncedSearch, statusFilter, entryFilter]);
  // Clear bulk selection whenever list filters/page change (deps are intentional triggers).
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset triggers, not values read in body
  useEffect(() => {
    setRowSelection({});
  }, [debouncedSearch, statusFilter, entryFilter, skip]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [formatId, setFormatId] = useState("");
  const [sizeId, setSizeId] = useState("");
  const [arenaDurationMinutes, setArenaDurationMinutes] = useState("");
  const [visibility, setVisibility] = useState("");
  const [freeEntry, setFreeEntry] = useState(true);
  const [entryFee, setEntryFee] = useState("");
  const [brandColor, setBrandColor] = useState("");
  const [needsTopUp, setNeedsTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [prizePoolDisplay, setPrizePoolDisplay] = useState(false);
  const [prizePoolGuarantee, setPrizePoolGuarantee] = useState(false);
  const [guaranteeAmount, setGuaranteeAmount] = useState("");
  const [topUpReasonKey, setTopUpReasonKey] = useState("");
  const [payoutMode, setPayoutMode] = useState("");
  const [prizePercent1, setPrizePercent1] = useState("");
  const [prizePercent2, setPrizePercent2] = useState("");
  const [prizePercent3, setPrizePercent3] = useState("");
  const [rowSelection, setRowSelection] = useState<OpsRowSelectionState>({});
  const [bulkPending, setBulkPending] = useState(false);
  const createTopUpSectionRef = useRef<HTMLDivElement | null>(null);

  const chromeQuery = useEventsOrganizerChromeQuery(Boolean(token) || !hydrated);
  const chrome = isEventsOrganizerChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const pageSize = parseListPageSize(chrome?.list_page_size);
  // Warm cash chrome so create failures (phone_kyc, etc.) toast DB copy, never API JSON.
  useCashRmgChromeQuery(Boolean(token));
  const catalogQuery = useEventsCatalogQuery(Boolean(token));
  const enumsQuery = useClientEnumsQuery(Boolean(token) || !hydrated);
  const listQuery = useEventsListQuery(
    token,
    skip,
    pageSize,
    entryFilter,
    debouncedSearch,
    statusFilter === STATUS_ALL ? "" : statusFilter,
  );
  const create = useCreateHostedEventMutation(token);
  const closeEvent = useCloseHostedEventMutation(token);
  const reopenEvent = useReopenHostedEventMutation(token);

  const geoQuery = useDetectBrowserCountryQuery(createDialog.open && Boolean(token));
  const country = (geoQuery.data ?? "").trim();
  const selectedSize = (catalogQuery.data?.sizes ?? []).find((s) => s.id === sizeId);
  const publicVisCode = (catalogQuery.data?.hosted_event_public_visibility || "").trim();
  const privateVisCode = (catalogQuery.data?.hosted_event_private_visibility || "").trim();
  const hostFee =
    publicVisCode && visibility === publicVisCode
      ? typeof selectedSize?.public_host_fee_amount === "number"
        ? selectedSize.public_host_fee_amount
        : null
      : typeof selectedSize?.host_fee_amount === "number"
        ? selectedSize.host_fee_amount
        : null;
  const hostCurrency = selectedSize?.host_fee_currency ?? "";
  const sizeHostFee = (s: {
    host_fee_amount: number;
    public_host_fee_amount?: number;
  }): number | null =>
    publicVisCode && visibility === publicVisCode
      ? typeof s.public_host_fee_amount === "number"
        ? s.public_host_fee_amount
        : null
      : typeof s.host_fee_amount === "number"
        ? s.host_fee_amount
        : null;
  const entryFeeQuoteQuery = useEntryFeeQuoteQuery(
    token,
    entryFee,
    createDialog.open && !freeEntry && Boolean(token),
  );
  const walletQuery = useWalletQuery(
    token,
    createDialog.open && Boolean(token) && Boolean(country),
  );
  const routeQuery = usePaymentRouteQuery(createDialog.open && Boolean(country));
  const isManual = routeQuery.data?.provider === "manual_transfer";
  const payChromeQuery = usePaymentModalChromeQuery(createDialog.open && needsTopUp);
  const payChrome = isPaymentModalChromeReady(payChromeQuery.data)
    ? payChromeQuery.data
    : undefined;
  const checkout = useCheckoutMutation(token);

  useEffect(() => {
    if (!needsTopUp || !createDialog.open) return;
    const el = createTopUpSectionRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [needsTopUp, createDialog.open]);

  useEffect(() => {
    if (!createDialog.open) {
      setNeedsTopUp(false);
      setTopUpAmount("");
      // Only clear after a real dismiss (not the render where openWith is scheduled).
      if (createDialogWasOpen.current) {
        hostCreatePreferPublic.current = false;
      }
      createDialogWasOpen.current = false;
      return;
    }
    createDialogWasOpen.current = true;
    if (!catalogQuery.data) return;
    // Host CTA → Community: keep prefer across a stale public_events_enabled=false snapshot.
    if (hostCreatePreferPublic.current) {
      const seed = resolveHostPreferPublicSeed(true, visibility, catalogQuery.data);
      if (seed.visibility != null && seed.visibility !== visibility) {
        setVisibility(seed.visibility);
      }
      if (seed.clearPrefer) hostCreatePreferPublic.current = false;
    } else if (!visibility) {
      const def = (catalogQuery.data.default_visibility || "").trim();
      if (def) setVisibility(def);
    }
    // Seed Format / Host size defaults when dialog opens (first catalog options).
    if (!formatId) {
      const firstFormat = (catalogQuery.data.formats ?? []).find(
        (f) => (f.label || "").trim().length > 0,
      );
      if (firstFormat?.id) setFormatId(firstFormat.id);
    }
  }, [createDialog.open, catalogQuery.data, visibility, formatId]);

  // Mid-dialog: admin toggled public_events_enabled off - leave Public selection.
  useEffect(() => {
    if (!createDialog.open || !catalogQuery.data) return;
    const next = resolveHostVisibilityAfterCatalog(visibility, catalogQuery.data);
    if (next !== visibility) setVisibility(next);
  }, [createDialog.open, catalogQuery.data, visibility]);

  useEffect(() => {
    if (!createDialog.open || !formatId || sizeId) return;
    const allowed = (catalogQuery.data?.sizes ?? []).filter(
      (s) => (s.label || "").trim().length > 0 && s.allowed_format_ids.includes(formatId),
    );
    const first = allowed[0];
    if (first?.id) setSizeId(first.id);
  }, [createDialog.open, formatId, sizeId, catalogQuery.data?.sizes]);

  // Host CTA: /events/events?create=1 opens today's create flow (then strip query).
  useEffect(() => {
    if (!wantCreate || !token || !chrome || deepLinkId || createDeepLinkOpened.current) return;
    createDeepLinkOpened.current = true;
    hostCreatePreferPublic.current = true;
    createDialog.openWith(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("create");
    const q = params.toString();
    router.replace(q ? `/events/events?${q}` : "/events/events", { scroll: false });
  }, [wantCreate, token, chrome, deepLinkId, router, searchParams, createDialog.openWith]);

  // Notification deep link: /events/events?id=<eventId> opens manage dialog.
  useEffect(() => {
    if (!deepLinkId) {
      deepLinkOpened.current = "";
      return;
    }
    if (!token || deepLinkOpened.current === deepLinkId) return;
    const rows = listQuery.data?.events ?? [];
    const hit = rows.find((e) => e.id === deepLinkId);
    if (hit) {
      deepLinkOpened.current = deepLinkId;
      openDetail(hit);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { data: ev } = await restClient.get<HostedEvent>(
          `/events/${encodeURIComponent(deepLinkId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (cancelled || !ev?.id) return;
        deepLinkOpened.current = deepLinkId;
        openDetail(ev);
      } catch {
        // Fail closed when id is missing or unauthorized.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deepLinkId, listQuery.data, token, openDetail]);

  const prizePoolDisplayCatalog = catalogQuery.data?.prize_pool_display_enabled === true;
  const prizePoolGuaranteeCatalog = catalogQuery.data?.prize_pool_guarantee_enabled === true;
  const prizeGuaranteeActive =
    !freeEntry &&
    prizePoolDisplayCatalog &&
    prizePoolDisplay &&
    prizePoolGuaranteeCatalog &&
    prizePoolGuarantee;
  const walletNeedForCreate = useMemo(() => {
    const host = hostFee != null && hostFee > 0 ? hostFee : 0;
    const g = prizeGuaranteeActive ? parsePositiveDecimal(guaranteeAmount) : null;
    const gAmt = g != null && g > 0 ? g : 0;
    // Only combine when host and guarantee share currency (create uses host_fee_currency for entry).
    // Never invent a cross-currency sum.
    const cur = (hostCurrency || "").trim();
    if (!cur) return host > 0 ? host : null;
    const need = host + gAmt;
    return need > 0 ? need : null;
  }, [hostFee, hostCurrency, prizeGuaranteeActive, guaranteeAmount]);

  useEffect(() => {
    if (
      !createDialog.open ||
      !needsTopUp ||
      !walletQuery.data ||
      walletNeedForCreate == null ||
      walletNeedForCreate <= 0
    ) {
      return;
    }
    const bal = walletQuery.data.balance;
    if (typeof bal !== "number" || bal >= walletNeedForCreate) return;
    const shortfall = walletNeedForCreate - bal;
    if (shortfall > 0 && !topUpAmount) {
      setTopUpAmount(sanitizeDecimalInput(String(shortfall)));
    }
  }, [createDialog.open, needsTopUp, walletQuery.data, walletNeedForCreate, topUpAmount]);

  const formats = (catalogQuery.data?.formats ?? []).filter(
    (f) => (f.label || "").trim().length > 0,
  );
  const sizes = useMemo(() => {
    const all = (catalogQuery.data?.sizes ?? []).filter((s) => (s.label || "").trim().length > 0);
    if (!formatId) return all;
    return all.filter((s) => s.allowed_format_ids.includes(formatId));
  }, [catalogQuery.data?.sizes, formatId]);

  const rows = listQuery.data?.events ?? [];

  const statusLabels = enumsQuery.data?.hosted_event_status_labels ?? {};
  const statuses = useMemo(() => {
    const fromEnums = (enumsQuery.data?.hosted_event_statuses ?? [])
      .map((s) => String(s || "").trim())
      .filter(Boolean);
    if (fromEnums.length > 0) return fromEnums;
    const set = new Set(rows.map((e) => e.status).filter(Boolean));
    return Array.from(set);
  }, [enumsQuery.data?.hosted_event_statuses, rows]);

  const detailLive = useMemo(() => {
    if (!detailDialog.value) return null;
    return rows.find((e) => e.id === detailDialog.value?.id) ?? detailDialog.value;
  }, [rows, detailDialog.value]);

  const columns = useMemo((): OpsColumn<HostedEvent>[] => {
    if (!chrome) return [];
    const cols: OpsColumn<HostedEvent>[] = [
      {
        id: "title",
        header: softHostingListTitle(chrome.list_title),
        cell: (e) => {
          const poolLines = hostedEventPrizePoolLines(e, prizePoolCardLabelsFromOrganizer(chrome));
          const empty = (chrome.empty_value || "").trim();
          const approved =
            typeof e.approved_count === "number" && Number.isFinite(e.approved_count)
              ? String(e.approved_count)
              : empty;
          const fillRight = seatCapFillRight(
            e.max_players,
            e.seat_cap_unlimited,
            chrome.unlimited_players_label || "",
          );
          const suffix = (chrome.players_count_suffix || "").trim();
          const playersLine = fillRight
            ? `${approved}/${fillRight} ${suffix}`.trim()
            : `${approved} ${suffix}`.trim();
          return (
            <div className="min-w-0">
              <p className="truncate font-medium">{e.title}</p>
              <p className="mt-0.5 truncate text-xs text-[var(--dama-muted)]">
                {[
                  (e.status_label || "").trim() || empty,
                  e.finished_at && (chrome.auto_closed_badge || "").trim()
                    ? chrome.auto_closed_badge
                    : "",
                  e.join_code,
                ]
                  .filter((part) => (part || "").trim().length > 0)
                  .join(chrome.meta_separator)}
              </p>
              {poolLines.map((line) => (
                <p
                  key={line}
                  className="mt-0.5 truncate text-xs font-medium text-[var(--dama-text)]"
                >
                  {line}
                </p>
              ))}
              <p className="mt-0.5 truncate text-xs text-[var(--dama-muted)]">{playersLine}</p>
            </div>
          );
        },
      },
      {
        id: "players",
        header: chrome.max_players_label,
        cell: (e) => {
          const empty = (chrome.empty_value || "").trim();
          const left = typeof e.approved_count === "number" ? String(e.approved_count) : empty;
          const fillRight = seatCapFillRight(
            e.max_players,
            e.seat_cap_unlimited,
            chrome.unlimited_players_label || "",
          );
          const suffix = (chrome.players_count_suffix || "").trim();
          const line = fillRight
            ? `${left}/${fillRight} ${suffix}`.trim()
            : `${left} ${suffix}`.trim();
          return <span className="tabular-nums text-sm text-[var(--dama-muted)]">{line}</span>;
        },
      },
      {
        id: "fee",
        header: chrome.host_fee_label,
        cell: (e) => {
          const empty = (chrome.empty_value || "").trim();
          const sep = chromeSeparator(chrome.amount_currency_separator);
          const cur = (e.host_fee_currency || "").trim();
          if (typeof e.host_fee_amount !== "number" || !cur || !chromeSeparatorPresent(sep)) {
            return <span className="tabular-nums text-sm">{empty}</span>;
          }
          return (
            <span className="tabular-nums text-sm">
              {e.host_fee_amount}
              {sep}
              {cur}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: (chrome.row_actions_label || "").trim() || chrome.manage_action,
        className: "w-12",
        cell: (e) => {
          const canClose = !e.started_at && !e.finished_at && !e.cancelled_at;
          const canReopen = Boolean(e.cancelled_at) && !e.started_at && !e.finished_at;
          const shareUrl = resolveEventInviteShareUrl({
            shareUrl: e.share_url,
            joinCode: e.join_code,
            sharePathTemplate: catalogQuery.data?.share_path_template,
            origin: typeof window !== "undefined" ? window.location.origin : "",
          });
          const actionsLabel =
            (chrome.row_actions_label || "").trim() || (chrome.manage_action || "").trim();
          return (
            <OpsDataTableRowActions
              triggerLabel={actionsLabel}
              actions={[
                {
                  id: "manage",
                  label: chrome.manage_action,
                  onSelect: () => openDetail(e),
                },
                ...(shareUrl && (chrome.copy_link_action || "").trim()
                  ? [
                      {
                        id: "copy_link",
                        label: chrome.copy_link_action,
                        onSelect: () => {
                          void (async () => {
                            try {
                              await navigator.clipboard.writeText(shareUrl);
                              toast.success(chrome.copied_blurb);
                            } catch {
                              toast.error(chrome.toast_copy_failed);
                            }
                          })();
                        },
                      },
                    ]
                  : []),
                ...((chrome.download_qr_action || "").trim() && (token || "").trim()
                  ? [
                      {
                        id: "download_qr",
                        label: chrome.download_qr_action,
                        onSelect: () => {
                          void (async () => {
                            try {
                              const res = await fetch(
                                `${apiRestUrl()}/events/${encodeURIComponent(e.id)}/qr.png`,
                                {
                                  credentials: "include",
                                  headers: { Authorization: `Bearer ${token}` },
                                },
                              );
                              if (!res.ok) {
                                toast.error(chrome.toast_qr_download_failed);
                                return;
                              }
                              const filename = filenameFromContentDisposition(
                                res.headers.get("Content-Disposition"),
                              );
                              if (!filename) {
                                toast.error(chrome.toast_qr_download_failed);
                                return;
                              }
                              const blob = await res.blob();
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = filename;
                              a.click();
                              URL.revokeObjectURL(url);
                            } catch {
                              toast.error(chrome.toast_qr_download_failed);
                            }
                          })();
                        },
                      },
                    ]
                  : []),
                ...(canClose && softHostingCloseAction(chrome.close_action)
                  ? [
                      {
                        id: "close",
                        label: softHostingCloseAction(chrome.close_action),
                        isLoading:
                          (closeEvent.isPending && closeEvent.variables === e.id) ||
                          (bulkPending && Boolean(rowSelection[e.id])),
                        pendingLabel:
                          (chrome.bulk_action_pending || "").trim() ||
                          softHostingCloseAction(chrome.close_action),
                        onSelect: () => closeEvent.mutate(e.id),
                      },
                    ]
                  : []),
                ...(canReopen && softHostingReopenAction(chrome.reopen_action)
                  ? [
                      {
                        id: "reopen",
                        label: softHostingReopenAction(chrome.reopen_action),
                        isLoading:
                          (reopenEvent.isPending && reopenEvent.variables === e.id) ||
                          (bulkPending && Boolean(rowSelection[e.id])),
                        pendingLabel:
                          (chrome.bulk_action_pending || "").trim() ||
                          softHostingReopenAction(chrome.reopen_action),
                        onSelect: () => reopenEvent.mutate(e.id),
                      },
                    ]
                  : []),
              ]}
            />
          );
        },
      },
    ];
    return cols.filter((col) => Boolean(col.header.trim()));
  }, [
    bulkPending,
    chrome,
    closeEvent,
    openDetail,
    reopenEvent,
    rowSelection,
    token,
    catalogQuery.data?.share_path_template,
  ]);

  function resetCreateForm() {
    setTitle("");
    setDescription("");
    setFormatId("");
    setSizeId("");
    setVisibility((catalogQuery.data?.default_visibility || "").trim());
    setFreeEntry(true);
    setEntryFee("");
    setBrandColor("");
    setNeedsTopUp(false);
    setTopUpReasonKey("");
    setTopUpAmount("");
    setPrizePoolDisplay(false);
    setPrizePoolGuarantee(false);
    setGuaranteeAmount("");
    setPayoutMode("");
    setPrizePercent1("");
    setPrizePercent2("");
    setPrizePercent3("");
  }

  useEffect(() => {
    if (!prizePoolDisplay || !enumsQuery.data || payoutMode.trim()) return;
    const def = defaultPayoutModeForFormat(enumsQuery.data, formatId);
    if (def) setPayoutMode(def);
    if (!prizePercent1.trim()) {
      setPrizePercent1((enumsQuery.data.competition_default_place_percent_1 || "").trim());
      setPrizePercent2((enumsQuery.data.competition_default_place_percent_2 || "").trim());
      setPrizePercent3((enumsQuery.data.competition_default_place_percent_3 || "").trim());
    }
  }, [prizePoolDisplay, formatId, enumsQuery.data, payoutMode, prizePercent1]);

  if (!hydrated) return <EventsListSkeleton />;

  if (!token) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--dama-muted)]">
          <SignInLink className="text-[var(--dama-gold)] underline" />
        </p>
      </div>
    );
  }

  if (chromeQuery.isLoading || catalogQuery.isLoading) {
    return <EventsListSkeleton />;
  }

  if (chromeQuery.isError || !chrome) {
    const unavailable = softHostingChromeUnavailable(
      (chromeQuery.data?.events_organizer_chrome_unavailable || "").trim(),
    );
    return (
      <div className="w-full space-y-4">
        {unavailable ? (
          <p className="text-sm text-[var(--dama-danger)]" role="alert">
            {unavailable}
          </p>
        ) : null}
      </div>
    );
  }

  // Catalog hosted_events_enabled === false → Hosting manage/create gated (player Community parity).
  if (catalogQuery.data?.hosted_events_enabled === false) {
    return (
      <div className="w-full space-y-4">
        <output className="block text-sm text-[var(--dama-muted)]">
          {softHostingFeatureDisabled(chrome.feature_disabled)}
        </output>
      </div>
    );
  }

  const softFetching = listQuery.isFetching && !listQuery.isLoading;
  const topUpValid = parsePositiveDecimal(topUpAmount) != null;
  const publicEventsEnabled = catalogQuery.data?.public_events_enabled === true;
  const visibilityOptions = (catalogQuery.data?.hosted_event_visibilities ?? []).filter(
    (v) => publicEventsEnabled || !publicVisCode || v !== publicVisCode,
  );
  const visibilityBlurb =
    publicVisCode && visibility === publicVisCode
      ? softHostingVisibilityPublicBlurb(chrome.visibility_public_blurb)
      : privateVisCode && visibility === privateVisCode
        ? softHostingVisibilityPrivateBlurb(chrome.visibility_private_blurb)
        : "";
  const publicRatedBlurb =
    publicVisCode && visibility === publicVisCode
      ? softCommunityJoinStatusMessage(
          catalogQuery.data?.public_event_matches_rated === true
            ? chrome.public_rated_on_blurb
            : chrome.public_rated_off_blurb,
        )
      : "";
  const isArenaFormat = tournamentFormatIsArena(formatId, enumsQuery.data, catalogQuery.data);
  const arenaDurationParsed = Number.parseInt(arenaDurationMinutes.trim(), 10);
  const arenaDurationOk =
    !isArenaFormat || (Number.isFinite(arenaDurationParsed) && arenaDurationParsed > 0);
  const canCreate =
    Boolean(title.trim()) &&
    Boolean(formatId) &&
    Boolean(sizeId) &&
    Boolean(visibility) &&
    !(publicVisCode && visibility === publicVisCode && !publicEventsEnabled) &&
    hostFee != null &&
    hostFee > 0 &&
    (freeEntry || parsePositiveDecimal(entryFee) != null) &&
    (!prizeGuaranteeActive || parsePositiveDecimal(guaranteeAmount) != null) &&
    arenaDurationOk;

  const createShellStyle = eventsDialogShellStyle(chrome, { wide: true });
  if (!createShellStyle) return null;

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {softHostingListTitle(chrome.list_title)}
            </h1>
            <HostTrustBadge
              label={meQuery.data?.hostTrustBadge}
              tier={meQuery.data?.hostTrustTier}
              className="text-[10px]"
            />
          </div>
          {(() => {
            const rep = hostReputationLine({
              finished: meQuery.data?.hostFinishedPaidCups,
              cancelled: meQuery.data?.hostCancelledPaidCups,
              openReports: meQuery.data?.hostOpenReports,
              finishedLabel: chrome.host_rep_finished_label,
              cancelledLabel: chrome.host_rep_cancelled_label,
              reportsLabel: chrome.host_rep_reports_label,
              separator: chrome.host_rep_meta_separator,
            });
            return rep ? (
              <p className="mt-1 text-[11px] text-[var(--dama-muted)]" title={rep}>
                {rep}
              </p>
            ) : null;
          })()}
          <p
            className="mt-1 text-sm text-[var(--dama-muted)]"
            style={(() => {
              const w = Number((chrome.list_blurb_max_width || "").trim());
              return Number.isFinite(w) && w > 0 ? { maxWidth: w } : undefined;
            })()}
          >
            {softHostingListBlurb(chrome.list_blurb)}
          </p>
        </div>
        <Button
          type="button"
          variant="gold"
          className="gap-2"
          onClick={() => createDialog.openWith(true)}
        >
          <Plus className="h-4 w-4" aria-hidden />
          {softHostingCreateAction(chrome.create_action)}
        </Button>
      </div>

      <div className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] shadow-[var(--dama-card-shadow)]">
        <div className="flex flex-col gap-3 border-b border-[var(--dama-border)] p-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[var(--dama-muted)]">
              {chrome.filter_entry_label}
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", chrome.filter_all_label],
                  ["free", chrome.filter_free_label],
                  ["paid", chrome.filter_paid_label],
                ] as const
              ).map(([id, label]) => (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant={entryFilter === id ? "gold" : "outline"}
                  onClick={() => setEntryFilter(id)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div
              className="w-full"
              style={(() => {
                const w = Number((chrome.search_field_max_width || "").trim());
                return Number.isFinite(w) && w > 0 ? { maxWidth: w } : undefined;
              })()}
            >
              <Field
                id="events-search"
                label={softHostingSearchLabel(chrome.search_label)}
                className="w-full"
              >
                <Input
                  id="events-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={softHostingSearchPlaceholder(chrome.search_placeholder)}
                  autoComplete="off"
                />
              </Field>
            </div>
            {statuses.length > 0 ? (
              <Field
                id="events-status"
                label={chrome.status_filter_label}
                className="w-full sm:w-auto"
              >
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="events-status">
                    <SelectValue placeholder={chrome.status_filter_label} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={STATUS_ALL}>
                      {(chrome.filter_status_all || "").trim() || (chrome.empty_value || "").trim()}
                    </SelectItem>
                    {statuses.map((status) => {
                      const fromEnum = (statusLabels[status] || "").trim();
                      const fromRow = rows.find((e) => e.status === status)?.status_label?.trim();
                      const labeled = fromEnum || fromRow || (chrome.empty_value || "").trim();
                      return (
                        <SelectItem key={status} value={status}>
                          {labeled}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
          </div>
        </div>
        {listQuery.isLoading ? (
          <div className="p-2">
            <OpsDataTableSkeleton columns={5} rows={6} embedded />
          </div>
        ) : (
          <OpsDataTable
            className="rounded-none border-0"
            columns={columns}
            data={rows}
            getRowId={(e) => e.id}
            isFetching={softFetching || bulkPending}
            meta={listQuery.data?.meta}
            onPage={(next) => {
              setRowSelection({});
              setSkip(next);
            }}
            pageDisabled={softFetching || bulkPending}
            pageInputId="events-list-skip"
            empty={<span>{softHostingEmptyList(chrome.empty_list)}</span>}
            selection={
              (chrome.select_all_label || "").trim() && (chrome.select_row_label || "").trim()
                ? {
                    chrome: {
                      selectAllLabel: (chrome.select_all_label || "").trim(),
                      selectRowLabel: (chrome.select_row_label || "").trim(),
                      selectedCountFmt: (chrome.selected_count_fmt || "").trim() || undefined,
                    },
                    rowSelection,
                    onRowSelectionChange: setRowSelection,
                    toolbar: (
                      <>
                        {(chrome.bulk_close_action || "").trim() ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={
                              bulkPending ||
                              selectedRowIds(rowSelection).length === 0 ||
                              !selectedRowIds(rowSelection).some((id) => {
                                const e = rows.find((r) => r.id === id);
                                return Boolean(
                                  e && !e.started_at && !e.finished_at && !e.cancelled_at,
                                );
                              })
                            }
                            isLoading={bulkPending}
                            pendingLabel={chrome.bulk_action_pending}
                            onClick={() => {
                              const ids = selectedRowIds(rowSelection).filter((id) => {
                                const e = rows.find((r) => r.id === id);
                                return Boolean(
                                  e && !e.started_at && !e.finished_at && !e.cancelled_at,
                                );
                              });
                              if (!ids.length) return;
                              setBulkPending(true);
                              void (async () => {
                                try {
                                  for (const id of ids) {
                                    await closeEvent.mutateAsync(id);
                                  }
                                  setRowSelection({});
                                } finally {
                                  setBulkPending(false);
                                }
                              })();
                            }}
                          >
                            {chrome.bulk_close_action}
                          </Button>
                        ) : null}
                        {(chrome.bulk_reopen_action || "").trim() ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={
                              bulkPending ||
                              selectedRowIds(rowSelection).length === 0 ||
                              !selectedRowIds(rowSelection).some((id) => {
                                const e = rows.find((r) => r.id === id);
                                return Boolean(e?.cancelled_at && !e.started_at && !e.finished_at);
                              })
                            }
                            isLoading={bulkPending}
                            pendingLabel={chrome.bulk_action_pending}
                            onClick={() => {
                              const ids = selectedRowIds(rowSelection).filter((id) => {
                                const e = rows.find((r) => r.id === id);
                                return Boolean(e?.cancelled_at && !e.started_at && !e.finished_at);
                              });
                              if (!ids.length) return;
                              setBulkPending(true);
                              void (async () => {
                                try {
                                  for (const id of ids) {
                                    try {
                                      await reopenEvent.mutateAsync(id);
                                    } catch {
                                      // Abort remaining reopens on first failure (e.g. 402 guarantee).
                                      break;
                                    }
                                  }
                                  setRowSelection({});
                                } finally {
                                  setBulkPending(false);
                                }
                              })();
                            }}
                          >
                            {chrome.bulk_reopen_action}
                          </Button>
                        ) : null}
                        {(chrome.clear_selection_action || "").trim() ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={bulkPending}
                            onClick={() => setRowSelection({})}
                          >
                            {chrome.clear_selection_action}
                          </Button>
                        ) : null}
                      </>
                    ),
                  }
                : undefined
            }
          />
        )}
      </div>

      <Dialog open={createDialog.open} onOpenChange={createDialog.onOpenChange}>
        <DialogContent
          className="w-full max-h-none"
          style={createShellStyle}
          closeLabel={(chrome.dialog_close_label || "").trim() || undefined}
        >
          <DialogHeader>
            <DialogTitle>{softHostingCreateTitle(chrome.create_title)}</DialogTitle>
            <DialogDescription>{softHostingCreateBlurb(chrome.create_blurb)}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="create-event-title"
              label={softHostingTitleLabel(chrome.title_label)}
              className="sm:col-span-2"
            >
              <Input
                id="create-event-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={chrome.title_placeholder}
                autoComplete="off"
              />
            </Field>
            <Field
              id="create-event-description"
              label={chrome.description_label}
              className="sm:col-span-2"
            >
              <textarea
                id="create-event-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder={chrome.description_placeholder}
                className="flex w-full rounded-md border border-[var(--dama-border)] bg-[var(--dama-input)] px-3 py-2 text-sm text-[var(--dama-text)] transition-colors placeholder:text-[var(--dama-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dama-brand)] disabled:cursor-not-allowed disabled:opacity-50"
              />
            </Field>
            <Field id="create-format" label={chrome.format_label}>
              <Select
                value={formatId || undefined}
                onValueChange={(v) => {
                  setFormatId(v);
                  setSizeId("");
                  if (tournamentFormatIsArena(v, enumsQuery.data, catalogQuery.data)) {
                    const d = parseDefaultArenaDurationMinutes(enumsQuery.data);
                    setArenaDurationMinutes(d != null ? String(d) : "");
                  } else {
                    setArenaDurationMinutes("");
                  }
                }}
              >
                <SelectTrigger id="create-format">
                  <SelectValue placeholder={chrome.format_label} />
                </SelectTrigger>
                <SelectContent>
                  {formats.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {(f.label || "").trim()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {isArenaFormat ? (
              <ArenaDurationField
                idPrefix="create"
                chrome={chrome}
                minutesValue={arenaDurationMinutes}
                onMinutesChange={setArenaDurationMinutes}
              />
            ) : null}
            <Field id="create-size" label={chrome.size_label}>
              <Select value={sizeId || undefined} onValueChange={setSizeId}>
                <SelectTrigger id="create-size">
                  <SelectValue placeholder={chrome.size_label} />
                </SelectTrigger>
                <SelectContent>
                  {sizes.map((s) => {
                    const fee = sizeHostFee(s);
                    const empty = (chrome.empty_value || "").trim();
                    const moneySep = chromeSeparator(chrome.amount_currency_separator);
                    const hostCur = (s.host_fee_currency || "").trim();
                    const feeText =
                      fee != null && hostCur && chromeSeparatorPresent(moneySep)
                        ? `${fee}${moneySep}${hostCur}`
                        : empty;
                    const labelText = (s.label || "").trim();
                    const seatText = formatSeatCapDisplay(
                      s.max_players,
                      catalogQuery.data?.swiss_rounds_by_max_players,
                      chrome.unlimited_players_label || "",
                      empty,
                    );
                    // Avoid "Unlimited · Unlimited" when catalog label already is the Unlimited chrome.
                    const showSeat = Boolean(seatText) && seatText !== labelText;
                    return (
                      <SelectItem key={s.id} value={s.id}>
                        {labelText}
                        {showSeat ? (
                          <>
                            {chrome.meta_separator}
                            {seatText}
                          </>
                        ) : null}
                        {chrome.meta_separator}
                        {chrome.players_count_suffix}
                        {chrome.meta_separator}
                        {feeText}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </Field>
            {selectedSize ? (
              <p className="sm:col-span-2 text-sm text-[var(--dama-muted)]">
                {chrome.host_fee_label}
                {chrome.meta_separator}
                <span className="font-mono text-[var(--dama-gold)]">
                  {(() => {
                    const empty = (chrome.empty_value || "").trim();
                    const sep = chromeSeparator(chrome.amount_currency_separator);
                    const cur = (selectedSize.host_fee_currency || "").trim();
                    if (hostFee == null || !cur || !chromeSeparatorPresent(sep)) return empty;
                    return `${hostFee}${sep}${cur}`;
                  })()}
                </span>
                {chrome.meta_separator}
                {chrome.max_players_label}
                {chrome.meta_separator}
                {formatSeatCapDisplay(
                  selectedSize.max_players,
                  catalogQuery.data?.swiss_rounds_by_max_players,
                  chrome.unlimited_players_label || "",
                  (chrome.empty_value || "").trim(),
                )}
              </p>
            ) : null}
            <div className="flex items-center gap-2 sm:col-span-2">
              <Checkbox
                id="create-free-entry"
                checked={freeEntry}
                onCheckedChange={(v) => {
                  const on = v === true;
                  setFreeEntry(on);
                  if (on) {
                    setPrizePoolDisplay(false);
                    setPrizePoolGuarantee(false);
                    setGuaranteeAmount("");
                  }
                }}
              />
              <label htmlFor="create-free-entry" className="text-sm">
                {chrome.entry_free_label}
              </label>
            </div>
            {!freeEntry ? (
              <Field id="create-entry-fee" label={chrome.entry_fee_label} className="sm:col-span-2">
                <AmountInput
                  id="create-entry-fee"
                  value={entryFee}
                  onValueChange={setEntryFee}
                  placeholder={chrome.entry_fee_placeholder}
                />
                {(() => {
                  const quote = entryFeeQuoteQuery.data;
                  const blurbTpl = (chrome.commission_blurb_template || "").trim();
                  if (!quote || !blurbTpl) return null;
                  return (
                    <div className="mt-2 space-y-1 text-xs text-[var(--dama-muted)]">
                      <p>
                        {chrome.commission_percent_label}
                        {chrome.meta_separator}
                        {quote.commission_percent}
                      </p>
                      <p>{blurbTpl.replaceAll("{percent}", String(quote.commission_percent))}</p>
                      <p className="font-mono">
                        {chrome.payments_commission_label}
                        {chrome.meta_separator}
                        {quote.commission}
                        {chrome.meta_separator}
                        {chrome.payments_organizer_net_label}
                        {chrome.meta_separator}
                        {quote.organizer_net}
                      </p>
                    </div>
                  );
                })()}
              </Field>
            ) : null}
            {!freeEntry && prizePoolDisplayCatalog ? (
              <>
                <div className="sm:col-span-2 space-y-2 rounded-lg border border-[var(--dama-border)] p-3">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="create-prize-pool-display"
                      checked={prizePoolDisplay}
                      onCheckedChange={(v) => {
                        const on = v === true;
                        setPrizePoolDisplay(on);
                        if (!on) {
                          setPrizePoolGuarantee(false);
                          setGuaranteeAmount("");
                        }
                      }}
                    />
                    <div className="min-w-0">
                      <label htmlFor="create-prize-pool-display" className="text-sm font-medium">
                        {chrome.prize_pool_display_label}
                      </label>
                      <p className="mt-1 text-xs text-[var(--dama-muted)]">
                        {chrome.prize_pool_display_blurb}
                      </p>
                    </div>
                  </div>
                </div>
                {prizePoolDisplay && prizePoolGuaranteeCatalog ? (
                  <>
                    <div className="sm:col-span-2 space-y-2 rounded-lg border border-[var(--dama-border)] p-3">
                      <div className="flex items-start gap-2">
                        <Checkbox
                          id="create-prize-pool-guarantee"
                          checked={prizePoolGuarantee}
                          onCheckedChange={(v) => {
                            const on = v === true;
                            setPrizePoolGuarantee(on);
                            if (!on) setGuaranteeAmount("");
                          }}
                        />
                        <div className="min-w-0">
                          <label
                            htmlFor="create-prize-pool-guarantee"
                            className="text-sm font-medium"
                          >
                            {chrome.prize_pool_guarantee_label}
                          </label>
                          <p className="mt-1 text-xs text-[var(--dama-muted)]">
                            {chrome.prize_pool_guarantee_blurb}
                          </p>
                        </div>
                      </div>
                    </div>
                    {prizePoolGuarantee ? (
                      <Field
                        id="create-guarantee-amount"
                        label={chrome.prize_pool_guarantee_amount_label}
                        className="sm:col-span-2"
                      >
                        <AmountInput
                          id="create-guarantee-amount"
                          value={guaranteeAmount}
                          onValueChange={setGuaranteeAmount}
                          placeholder={chrome.prize_pool_guarantee_amount_placeholder}
                        />
                      </Field>
                    ) : null}
                  </>
                ) : null}
                {prizePoolDisplay && enumsQuery.data ? (
                  <div className="sm:col-span-2 space-y-3 rounded-lg border border-[var(--dama-border)] p-3">
                    <p className="text-sm font-medium">{chrome.payout_mode_label}</p>
                    <p className="text-xs text-[var(--dama-muted)]">{chrome.payout_mode_blurb}</p>
                    <Field id="create-payout-mode" label={chrome.payout_mode_label}>
                      <Select value={payoutMode || undefined} onValueChange={setPayoutMode}>
                        <SelectTrigger id="create-payout-mode">
                          <SelectValue placeholder={chrome.payout_mode_label} />
                        </SelectTrigger>
                        <SelectContent>
                          {payoutModeOptions(enumsQuery.data, formatId).map((opt) => {
                            const places = (
                              enumsQuery.data?.competition_payout_mode_places_percent || ""
                            ).trim();
                            const score = (
                              enumsQuery.data?.competition_payout_mode_score_share || ""
                            ).trim();
                            const dual = (
                              enumsQuery.data?.competition_payout_mode_dual_purse || ""
                            ).trim();
                            let label = opt.value;
                            if (opt.value === places)
                              label = chrome.payout_mode_places_percent_label;
                            if (opt.value === score) label = chrome.payout_mode_score_share_label;
                            if (opt.value === dual) label = chrome.payout_mode_dual_purse_label;
                            return (
                              <SelectItem key={opt.value} value={opt.value}>
                                {label}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </Field>
                    {payoutMode ===
                      (enumsQuery.data.competition_payout_mode_places_percent || "").trim() ||
                    payoutMode ===
                      (enumsQuery.data.competition_payout_mode_dual_purse || "").trim() ? (
                      <>
                        <p className="text-sm font-medium">
                          {chrome.prize_place_percents_section_label}
                        </p>
                        <p className="text-xs text-[var(--dama-muted)]">
                          {chrome.prize_place_percents_blurb}
                        </p>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Field id="create-pct-1" label={chrome.prize_place_percent_1_label}>
                            <Input
                              id="create-pct-1"
                              value={prizePercent1}
                              onChange={(e) => setPrizePercent1(e.target.value)}
                              placeholder={chrome.prize_place_percent_1_placeholder}
                            />
                          </Field>
                          <Field id="create-pct-2" label={chrome.prize_place_percent_2_label}>
                            <Input
                              id="create-pct-2"
                              value={prizePercent2}
                              onChange={(e) => setPrizePercent2(e.target.value)}
                              placeholder={chrome.prize_place_percent_2_placeholder}
                            />
                          </Field>
                          <Field id="create-pct-3" label={chrome.prize_place_percent_3_label}>
                            <Input
                              id="create-pct-3"
                              value={prizePercent3}
                              onChange={(e) => setPrizePercent3(e.target.value)}
                              placeholder={chrome.prize_place_percent_3_placeholder}
                            />
                          </Field>
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}
            <Field
              id="create-brand-color"
              label={chrome.brand_color_label}
              className="sm:col-span-2"
            >
              <Input
                id="create-brand-color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                placeholder={chrome.brand_color_placeholder}
                autoComplete="off"
              />
            </Field>
            <Field id="create-visibility" label={chrome.visibility_label} className="sm:col-span-2">
              <Select
                value={visibility || undefined}
                onValueChange={(v) => {
                  if (publicVisCode && v === publicVisCode && !publicEventsEnabled) return;
                  setVisibility(v);
                }}
              >
                <SelectTrigger id="create-visibility">
                  <SelectValue placeholder={chrome.visibility_label} />
                </SelectTrigger>
                <SelectContent>
                  {visibilityOptions.map((v) => (
                    <SelectItem key={v} value={v}>
                      {publicVisCode && v === publicVisCode
                        ? chrome.visibility_public_label
                        : chrome.visibility_private_label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {visibilityBlurb ? (
                <p className="mt-1 text-xs text-[var(--dama-muted)]">{visibilityBlurb}</p>
              ) : null}
              {publicRatedBlurb ? (
                <p className="mt-1 text-xs text-[var(--dama-muted)]">{publicRatedBlurb}</p>
              ) : null}
              {!publicEventsEnabled ? (
                <p className="mt-1 text-xs text-[var(--dama-muted)]">
                  {softHostingPublicDisabled(chrome.public_disabled)}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-[var(--dama-muted)]">
                {softCommunityJoinStatusMessage(chrome.force_auto_approve_note)}
              </p>
            </Field>
            {needsTopUp ? (
              <div
                ref={createTopUpSectionRef}
                id="create-host-fee-topup"
                className="sm:col-span-2 space-y-3 rounded-lg border border-[var(--dama-border)] p-3"
              >
                <p className="text-sm text-[var(--dama-danger)]">
                  {topUpReasonKey === "insufficient_prize_guarantee" ||
                  topUpReasonKey === "err_reopen_guarantee_hold_failed"
                    ? (chrome.insufficient_prize_guarantee || "").trim()
                    : (chrome.insufficient_host_fee || "").trim()}
                </p>
                {payChrome && !isManual ? (
                  <>
                    <Field id="create-topup" label={payChrome.amount_label}>
                      <AmountInput
                        id="create-topup"
                        value={topUpAmount}
                        onValueChange={setTopUpAmount}
                        placeholder={payChrome.amount_placeholder}
                      />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="gold"
                        disabled={!country || !topUpValid}
                        isLoading={checkout.isPending}
                        pendingLabel={payChrome.checkout_pending}
                        onClick={() => {
                          const n = parsePositiveDecimal(topUpAmount);
                          if (n == null || !country) return;
                          checkout.mutate({
                            amount: n,
                            purpose: "wallet_topup",
                            country_code: country,
                          });
                        }}
                      >
                        {payChrome.checkout_action}
                      </Button>
                      {withWalletFocusParam((chrome.portal_wallet_href || "").trim(), "topup") ? (
                        <Button asChild variant="outline">
                          <Link
                            href={withWalletFocusParam(
                              (chrome.portal_wallet_href || "").trim(),
                              "topup",
                            )}
                          >
                            {chrome.top_up_action}
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </>
                ) : withWalletFocusParam((chrome.portal_wallet_href || "").trim(), "topup") ? (
                  <Button asChild variant="gold">
                    <Link
                      href={withWalletFocusParam((chrome.portal_wallet_href || "").trim(), "topup")}
                    >
                      {chrome.top_up_action}
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => createDialog.close()}>
              {(chrome.dialog_close_label || "").trim() ||
                softHostingCancelAction(chrome.cancel_action)}
            </Button>
            <Button
              type="button"
              variant="gold"
              disabled={!canCreate}
              isLoading={create.isPending}
              pendingLabel={chrome.create_pending}
              onClick={() => {
                const feeNum = parsePositiveDecimal(entryFee);
                const body: Parameters<typeof create.mutate>[0] = {
                  title: title.trim(),
                  description: description.trim() || undefined,
                  format_id: formatId,
                  size_id: sizeId,
                  visibility,
                  is_free_entry: freeEntry,
                  entry_fee_amount: freeEntry ? undefined : (feeNum ?? undefined),
                  entry_fee_currency: freeEntry ? undefined : hostCurrency || undefined,
                  brand_color: brandColor.trim() || undefined,
                  country_code: country || undefined,
                };
                if (isArenaFormat) {
                  const d = Number.parseInt(arenaDurationMinutes.trim(), 10);
                  if (!Number.isFinite(d) || d <= 0) return;
                  body.arena_duration_minutes = d;
                }
                if (!freeEntry && prizePoolDisplayCatalog) {
                  body.prize_pool_display_enabled = prizePoolDisplay;
                  if (prizePoolDisplay && prizePoolGuaranteeCatalog) {
                    body.prize_pool_guarantee_enabled = prizePoolGuarantee;
                    if (prizePoolGuarantee) {
                      const guarantee = parsePositiveDecimal(guaranteeAmount);
                      if (guarantee == null) return;
                      body.prize_pool_guarantee_amount = guarantee;
                    }
                  }
                  if (prizePoolDisplay && payoutMode.trim()) {
                    body.prize_payout_mode = payoutMode.trim();
                    const placesMode = (
                      enumsQuery.data?.competition_payout_mode_places_percent || ""
                    ).trim();
                    const dualMode = (
                      enumsQuery.data?.competition_payout_mode_dual_purse || ""
                    ).trim();
                    if (payoutMode.trim() === placesMode || payoutMode.trim() === dualMode) {
                      if (placePercentsSumInvalid(prizePercent1, prizePercent2, prizePercent3)) {
                        return;
                      }
                      const percents = buildPlacePercentsPayload(
                        prizePercent1,
                        prizePercent2,
                        prizePercent3,
                      );
                      if (percents) body.prize_place_percents = percents;
                    }
                  }
                }
                create.mutate(body, {
                  onSuccess: () => {
                    resetCreateForm();
                    createDialog.close();
                  },
                  onError: (err) => {
                    const payErr = err as CreateHostedEventError;
                    if (payErr.paymentRequired) {
                      const key = (payErr.paymentErrorKey || payErr.errorKey || "").trim();
                      setTopUpReasonKey(key);
                      setNeedsTopUp(true);
                    }
                  },
                });
              }}
            >
              {chrome.pay_create_action}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {token ? (
        <ManageEventDialog
          open={detailDialog.open}
          onOpenChange={detailDialog.onOpenChange}
          event={detailLive}
          chrome={chrome}
          token={token}
          closeLabel={
            (chrome.dialog_close_label || "").trim() ||
            softHostingCancelAction(chrome.cancel_action)
          }
        />
      ) : null}
    </div>
  );
}
