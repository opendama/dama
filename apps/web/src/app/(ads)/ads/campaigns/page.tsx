"use client";

import { PublisherScheduleEditor } from "@/components/ads/PublisherScheduleEditor";
import {
  ViewportCreativesEditor,
  type ViewportCreativesChrome,
} from "@/components/ads/ViewportCreativesEditor";
import { SignInLink } from "@/components/auth/SignInLink";
import { LocationPinField } from "@/components/map/LocationPinField";
import { EntityMediaEditor } from "@/components/media/EntityMediaEditor";
import { GalleryCarousel } from "@/components/media/GalleryCarousel";
import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { DateTimeField } from "@/components/ui/date-time-field";
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
import { CampaignListSkeleton, OpsDataTableSkeleton } from "@/components/ui/shimmer-skeletons";
import { useAttachCampaignVideoMutation } from "@/hooks/mutation/useAttachCampaignVideoMutation";
import { useClearCampaignLegacyVideoMutation } from "@/hooks/mutation/useClearCampaignLegacyVideoMutation";
import { useClearCampaignThumbnailMutation } from "@/hooks/mutation/useClearCampaignThumbnailMutation";
import { useCloseCampaignMutation } from "@/hooks/mutation/useCloseCampaignMutation";
import { useCreateCampaignMutation } from "@/hooks/mutation/useCreateCampaignMutation";
import { useDeleteCampaignMutation } from "@/hooks/mutation/useDeleteCampaignMutation";
import { useRemoveCampaignGalleryMutation } from "@/hooks/mutation/useRemoveCampaignGalleryMutation";
import { useReopenCampaignMutation } from "@/hooks/mutation/useReopenCampaignMutation";
import { useReplaceCampaignCreativeMutation } from "@/hooks/mutation/useReplaceCampaignCreativeMutation";
import { useSetCampaignStatusMutation } from "@/hooks/mutation/useSetCampaignStatusMutation";
import { useUpdateCampaignTitleMutation } from "@/hooks/mutation/useUpdateCampaignTitleMutation";
import { useUploadCampaignGalleryMutation } from "@/hooks/mutation/useUploadCampaignGalleryMutation";
import { useUploadCampaignThumbnailMutation } from "@/hooks/mutation/useUploadCampaignThumbnailMutation";
import { useAdCampaignsQuery } from "@/hooks/query/useAdCampaignsQuery";
import { useAdPlaybackQuery } from "@/hooks/query/useAdPlaybackQuery";
import { useAdPricingQuery } from "@/hooks/query/useAdPricingQuery";
import { useClientEnumsQuery } from "@/hooks/query/useClientEnumsQuery";
import { useMediaUploadChromeQuery } from "@/hooks/query/useMediaUploadChromeQuery";
import { useWalletQuery } from "@/hooks/query/useWalletQuery";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDeferredDialogValue } from "@/hooks/use-deferred-dialog-selection";
import { useResetSkipOnChange } from "@/hooks/useResetSkipOnChange";
import { useUrlSkip } from "@/hooks/useUrlSkip";
import { restClient } from "@/lib/api";
import { chromeSeparator, chromeSeparatorPresent } from "@/lib/chrome-separator";
import { formatCountryLabel } from "@/lib/format-country-label";
import { locateGeo } from "@/lib/geo-locate";
import { reverseGeocodeNominatim } from "@/lib/nominatim-reverse";
import { withWalletFocusParam } from "@/lib/wallet-focus-href";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import {
  type AdScheduleChrome,
  isAdMapChromeReady,
  isAdMediaChromeReady,
  isViewportCreativesChromeReady,
} from "@/types/ad-playback";
import type { AdCampaign } from "@/types/ads";
import { type MediaUploadChrome, isMediaUploadChromeReady } from "@/types/media-upload-chrome";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const STATUS_ALL = "__all__";

type AdMediaChrome = AdScheduleChrome &
  Required<
    Pick<
      AdScheduleChrome,
      | "thumbnail_label"
      | "gallery_label"
      | "gallery_add_action"
      | "gallery_empty"
      | "gallery_max_slots"
      | "gallery_slots_fmt"
      | "thumbnail_main_badge"
      | "thumbnail_empty_hint"
      | "thumbnail_hint"
      | "gallery_limit_reached"
      | "thumbnail_upload_action"
      | "toast_thumbnail_saved"
      | "toast_gallery_saved"
      | "media_upload_failed"
    >
  >;

function parseListPageSize(raw: string | undefined): number {
  const n = Number.parseInt(String(raw || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export default function AdsCampaignsPage() {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const searchParams = useSearchParams();
  const deepLinkId = (searchParams.get("id") || "").trim();
  const deepLinkOpened = useRef("");
  const createDialog = useDeferredDialogValue<true>();
  const detailDialog = useDeferredDialogValue<AdCampaign>();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  const [statusFilter, setStatusFilter] = useState(STATUS_ALL);
  const [title, setTitle] = useState("");
  const [geoCountry, setGeoCountry] = useState("");
  const [geoCountryName, setGeoCountryName] = useState("");
  const [geoRegion, setGeoRegion] = useState("");
  const [geoDistrict, setGeoDistrict] = useState("");
  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLng, setGeoLng] = useState<number | null>(null);
  const [mapPinError, setMapPinError] = useState("");
  const [geoResolving, setGeoResolving] = useState(false);
  const [dailySpendCap, setDailySpendCap] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [detailTitle, setDetailTitle] = useState("");
  const [rowSelection, setRowSelection] = useState<OpsRowSelectionState>({});
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkPending, setBulkPending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdCampaign | null>(null);
  const [focusMediaAfterOpen, setFocusMediaAfterOpen] = useState(false);
  /** After create: put device creatives / media first in the detail dialog. */
  const [mediaFirstInDetail, setMediaFirstInDetail] = useState(false);
  const mediaSectionRef = useRef<HTMLDivElement | null>(null);
  const openDetail = useCallback(
    (c: AdCampaign, opts?: { focusMedia?: boolean }) => {
      setDetailTitle((c.title || "").trim());
      const focusMedia = Boolean(opts?.focusMedia);
      setFocusMediaAfterOpen(focusMedia);
      setMediaFirstInDetail(focusMedia);
      detailDialog.openWith(c);
    },
    [detailDialog.openWith],
  );

  useEffect(() => {
    if (!detailDialog.open || !focusMediaAfterOpen) return;
    const id = window.setTimeout(() => {
      mediaSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setFocusMediaAfterOpen(false);
    }, 80);
    return () => window.clearTimeout(id);
  }, [detailDialog.open, focusMediaAfterOpen]);

  const [skip, setSkip] = useUrlSkip("skip");
  const playbackQuery = useAdPlaybackQuery(Boolean(token));
  const pageChrome = playbackQuery.data?.schedule_chrome;
  const pageSize = parseListPageSize(pageChrome?.list_page_size);
  const statusApi = statusFilter !== STATUS_ALL ? statusFilter : "";
  useResetSkipOnChange(setSkip, [debouncedSearch, statusApi]);
  const campaignsQuery = useAdCampaignsQuery(token, skip, pageSize, {
    q: debouncedSearch,
    status: statusApi,
  });
  const { data: listData, isLoading } = campaignsQuery;
  const data = listData?.campaigns;
  const mediaChrome = isAdMediaChromeReady(pageChrome) ? pageChrome : undefined;
  const viewportCreativesChrome: ViewportCreativesChrome | undefined =
    isViewportCreativesChromeReady(pageChrome) ? pageChrome : undefined;
  const mediaUploadChromeQuery = useMediaUploadChromeQuery(Boolean(token));
  const dropzoneChrome = isMediaUploadChromeReady(mediaUploadChromeQuery.data)
    ? mediaUploadChromeQuery.data
    : undefined;
  const mapChrome = isAdMapChromeReady(pageChrome) ? pageChrome : undefined;
  const pricingQuery = useAdPricingQuery(geoLat, geoLng);
  const createFee =
    typeof pricingQuery.data?.campaign_create_fee_amount === "number"
      ? pricingQuery.data.campaign_create_fee_amount
      : null;
  const createFeeCurrency = (pricingQuery.data?.campaign_create_fee_currency || "").trim();
  const locateSeq = useRef(0);
  const handleMapPinChange = useCallback(
    async (lat: number, lng: number) => {
      const seq = ++locateSeq.current;
      setGeoLat(lat);
      setGeoLng(lng);
      setMapPinError("");
      setGeoResolving(true);
      try {
        // 1) Server /geo/locate first (authoritative; works when browser Nominatim is blocked).
        // 2) Client Nominatim enrich for English city/sub-city / country name when empty.
        let filled: {
          countryCode: string;
          countryName: string;
          region: string;
          city: string;
        } | null = null;
        try {
          const res = await locateGeo(token, { latitude: lat, longitude: lng });
          const cc = (res.location.country_code || "").trim().toUpperCase();
          if (cc.length === 2) {
            filled = {
              countryCode: cc,
              countryName: (res.location.country_name || "").trim(),
              region: (res.location.region || "").trim(),
              city: (res.location.city || "").trim(),
            };
          }
        } catch {
          filled = null;
        }
        if (seq !== locateSeq.current) return;

        const needEnrich = !filled || !filled.city || !filled.region || !filled.countryName;
        if (needEnrich) {
          const g = await reverseGeocodeNominatim(lat, lng);
          if (seq !== locateSeq.current) return;
          if (g && g.countryCode.length === 2) {
            filled = {
              countryCode: filled?.countryCode || g.countryCode,
              countryName: filled?.countryName || g.countryName,
              region: filled?.region || g.region,
              city: filled?.city || g.city,
            };
          }
        }

        if (!filled?.countryCode) {
          setGeoCountry("");
          setGeoCountryName("");
          setGeoRegion("");
          setGeoDistrict("");
          const fail = (pageChrome?.map_locate_failed || "").trim();
          if (fail) {
            setMapPinError(fail);
            toast.error(fail);
          }
          return;
        }
        setGeoCountry(filled.countryCode);
        setGeoCountryName(filled.countryName);
        setGeoRegion(filled.region);
        setGeoDistrict(filled.city);
      } catch {
        if (seq !== locateSeq.current) return;
        setGeoCountry("");
        setGeoCountryName("");
        setGeoRegion("");
        setGeoDistrict("");
        const fail = (pageChrome?.map_locate_failed || "").trim();
        if (fail) {
          setMapPinError(fail);
          toast.error(fail);
        }
      } finally {
        if (seq === locateSeq.current) setGeoResolving(false);
      }
    },
    [pageChrome?.map_locate_failed, token],
  );
  const handleMapPinClear = useCallback(() => {
    locateSeq.current += 1;
    setGeoLat(null);
    setGeoLng(null);
    setGeoCountry("");
    setGeoCountryName("");
    setGeoRegion("");
    setGeoDistrict("");
    setMapPinError("");
    setGeoResolving(false);
  }, []);
  const walletQuery = useWalletQuery(token, Boolean(token));
  const walletBal = typeof walletQuery.data?.balance === "number" ? walletQuery.data.balance : null;
  const walletCurrency = (walletQuery.data?.currency || createFeeCurrency || "").trim();
  const needsTopUp =
    createDialog.open &&
    createFee != null &&
    createFee > 0 &&
    Boolean(createFeeCurrency) &&
    walletQuery.isSuccess &&
    walletBal != null &&
    walletBal < createFee;
  const dailyCapParsed = Number(dailySpendCap.trim());
  const dailyCapOk = Number.isFinite(dailyCapParsed) && dailyCapParsed > 0;
  const enumsQuery = useClientEnumsQuery(Boolean(token));
  const campaignStatuses = enumsQuery.data?.campaign_statuses ?? [];
  const archivedStatus = (enumsQuery.data?.archived_campaign_status || "").trim();
  const defaultCreativeType = enumsQuery.data?.default_creative_type ?? "";
  const isArchived = useCallback(
    (status: string | undefined) =>
      Boolean(archivedStatus) && (status || "").trim() === archivedStatus,
    [archivedStatus],
  );
  const create = useCreateCampaignMutation(token);
  const setStatus = useSetCampaignStatusMutation(token);
  const deleteCampaign = useDeleteCampaignMutation(token);
  const updateTitle = useUpdateCampaignTitleMutation(token);
  const closeCampaign = useCloseCampaignMutation(token);
  const reopenCampaign = useReopenCampaignMutation(token);
  const attachYT = useAttachCampaignVideoMutation(token);
  const clearLegacyVideo = useClearCampaignLegacyVideoMutation(token);
  const replaceCreative = useReplaceCampaignCreativeMutation(token);
  const uploadThumbnail = useUploadCampaignThumbnailMutation(token);
  const clearThumbnail = useClearCampaignThumbnailMutation(token);
  const uploadGallery = useUploadCampaignGalleryMutation(token);
  const removeGallery = useRemoveCampaignGalleryMutation(token);
  const softFetching = campaignsQuery.isFetching && !campaignsQuery.isLoading;

  const detailLive = useMemo(() => {
    if (!detailDialog.value) return null;
    return (data ?? []).find((c) => c.id === detailDialog.value?.id) ?? detailDialog.value;
  }, [data, detailDialog.value]);

  useEffect(() => {
    if (detailLive) setDetailTitle((detailLive.title || "").trim());
  }, [detailLive]);

  // Notification deep link: /ads/campaigns?id=<campaignId> opens manage dialog.
  useEffect(() => {
    if (!deepLinkId) {
      deepLinkOpened.current = "";
      return;
    }
    if (!token || deepLinkOpened.current === deepLinkId) return;
    const rows = data ?? [];
    const hit = rows.find((c) => c.id === deepLinkId);
    if (hit) {
      deepLinkOpened.current = deepLinkId;
      openDetail(hit);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { data: c } = await restClient.get<AdCampaign>(
          `/ads/campaigns/${encodeURIComponent(deepLinkId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (cancelled || !c?.id) return;
        deepLinkOpened.current = deepLinkId;
        openDetail(c);
      } catch {
        // Fail closed: leave list as-is when id is missing or unauthorized.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deepLinkId, data, token, openDetail]);

  const campaignColumns = useMemo((): OpsColumn<AdCampaign>[] => {
    if (!pageChrome) return [];
    const titleHeader = (pageChrome.publisher_campaigns_heading || "").trim();
    const statusHeader = (pageChrome.status_label || pageChrome.filter_status_label || "").trim();
    const perfHeader = [
      (pageChrome.publisher_stat_impressions || "").trim(),
      (pageChrome.publisher_stat_clicks || "").trim(),
    ]
      .filter(Boolean)
      .join(pageChrome.meta_separator);
    // Never fall back to daily_cap_label (that is impression-period caps, not spend).
    const capHeader = (
      pageChrome.daily_spend_cap_label ||
      pageChrome.ph_daily_spend_cap ||
      ""
    ).trim();
    const endsHeader = (pageChrome.ends_at_label || "").trim();
    const viewLabel = (pageChrome.view_action || "").trim();
    const actionsLabel = (pageChrome.row_actions_label || "").trim();
    const deleteLabel = (pageChrome.delete_campaign_action || "").trim();
    const empty = (pageChrome.empty_value || "").trim();
    const canDeleteCampaign = (c: AdCampaign) => {
      const impressions = typeof c.impressions === "number" ? c.impressions : 0;
      const clicks = typeof c.clicks === "number" ? c.clicks : 0;
      return !c.auto_closed && impressions === 0 && clicks === 0;
    };
    const cols: OpsColumn<AdCampaign>[] = [
      {
        id: "title",
        header: titleHeader,
        cell: (c) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{c.title}</p>
            <p className="mt-0.5 truncate text-xs text-[var(--dama-muted)]">
              {(c.creative_type_label || "").trim() || empty}
              {c.auto_closed && (pageChrome.auto_closed_badge || "").trim()
                ? `${pageChrome.meta_separator}${pageChrome.auto_closed_badge}`
                : ""}
            </p>
          </div>
        ),
      },
    ];
    if (statusHeader) {
      cols.push({
        id: "status",
        header: statusHeader,
        className: "w-28",
        cell: (c) => (
          <span className="text-sm">
            {(c.status_label || "").trim() || empty}
            {c.auto_closed && (pageChrome.auto_closed_badge || "").trim()
              ? `${pageChrome.meta_separator}${pageChrome.auto_closed_badge}`
              : ""}
          </span>
        ),
      });
    }
    cols.push(
      {
        id: "stats",
        header: perfHeader,
        cell: (c) => (
          <span className="text-xs tabular-nums text-[var(--dama-muted)]">
            {typeof c.impressions === "number" ? c.impressions : empty}{" "}
            {pageChrome.stats_impressions_suffix}
            {pageChrome.meta_separator}
            {typeof c.clicks === "number" ? c.clicks : empty} {pageChrome.stats_clicks_suffix}
            {typeof c.unique_reach === "number"
              ? `${pageChrome.meta_separator}${c.unique_reach} ${pageChrome.stats_reach_suffix}`
              : ""}
          </span>
        ),
      },
      {
        id: "cap",
        header: capHeader,
        cell: (c) => {
          const sep = chromeSeparator(pageChrome.amount_currency_separator);
          const hasCap = c.daily_spend_cap != null && c.daily_spend_cap > 0;
          if (!hasCap) {
            return <span className="text-sm tabular-nums">{empty}</span>;
          }
          if (!walletCurrency || !chromeSeparatorPresent(sep)) {
            return <span className="text-sm tabular-nums">{c.daily_spend_cap}</span>;
          }
          return (
            <span className="text-sm tabular-nums">
              {c.daily_spend_cap}
              {sep}
              {walletCurrency}
            </span>
          );
        },
      },
    );
    if (endsHeader) {
      cols.push({
        id: "ends",
        header: endsHeader,
        className: "w-40",
        cell: (c) => (
          <span className="text-xs tabular-nums text-[var(--dama-muted)]">
            {(c.ends_at || "").trim() || empty}
          </span>
        ),
      });
    }
    if (viewLabel) {
      cols.push({
        id: "view",
        header: viewLabel,
        className: "w-24",
        cell: (c) => (
          <button
            type="button"
            className="text-left text-sm text-[var(--dama-text)] underline-offset-4 hover:underline"
            onClick={() => openDetail(c)}
          >
            {viewLabel}
          </button>
        ),
      });
    }
    if (actionsLabel) {
      cols.push({
        id: "actions",
        header: actionsLabel,
        className: "w-12",
        cell: (c) => (
          <OpsDataTableRowActions
            triggerLabel={actionsLabel}
            actions={[
              {
                id: "view",
                label: viewLabel,
                onSelect: () => openDetail(c),
              },
              ...(!c.auto_closed
                ? campaignStatuses.map((status) => ({
                    id: `status-${status}`,
                    label:
                      (enumsQuery.data?.campaign_status_labels?.[status] || "").trim() || status,
                    disabled: c.status === status,
                    isLoading: setStatus.isPending && setStatus.variables?.id === c.id,
                    pendingLabel: pageChrome.update_status_pending,
                    onSelect: () => setStatus.mutate({ id: c.id, status }),
                  }))
                : []),
              ...(pageChrome.close_campaign_action && !c.auto_closed && !isArchived(c.status)
                ? [
                    {
                      id: "close",
                      label: pageChrome.close_campaign_action,
                      isLoading: closeCampaign.isPending && closeCampaign.variables === c.id,
                      pendingLabel: pageChrome.close_campaign_action,
                      onSelect: () => closeCampaign.mutate(c.id),
                    },
                  ]
                : []),
              ...(pageChrome.reopen_campaign_action && isArchived(c.status) && !c.auto_closed
                ? [
                    {
                      id: "reopen",
                      label: pageChrome.reopen_campaign_action,
                      isLoading: reopenCampaign.isPending && reopenCampaign.variables === c.id,
                      pendingLabel: pageChrome.reopen_campaign_action,
                      onSelect: () => reopenCampaign.mutate(c.id),
                    },
                  ]
                : []),
              {
                id: "attach",
                label: pageChrome.attach_video_action,
                isLoading: attachYT.isPending && attachYT.variables === c.id,
                pendingLabel: pageChrome.attach_video_pending,
                onSelect: () => attachYT.mutate(c.id),
              },
              ...(deleteLabel && canDeleteCampaign(c)
                ? [
                    {
                      id: "delete",
                      label: deleteLabel,
                      destructive: true as const,
                      isLoading: deleteCampaign.isPending && deleteCampaign.variables === c.id,
                      pendingLabel: pageChrome.delete_campaign_pending,
                      onSelect: () => setDeleteTarget(c),
                    },
                  ]
                : []),
            ]}
          />
        ),
      });
    }
    return cols.filter((col) => Boolean(col.header.trim()) || col.id === "actions");
  }, [
    attachYT,
    campaignStatuses,
    closeCampaign,
    deleteCampaign,
    enumsQuery.data?.campaign_status_labels,
    isArchived,
    openDetail,
    pageChrome,
    reopenCampaign,
    setStatus,
    walletCurrency,
  ]);

  function resetCreateForm() {
    setTitle("");
    setGeoCountry("");
    setGeoCountryName("");
    setGeoRegion("");
    setGeoDistrict("");
    setGeoLat(null);
    setGeoLng(null);
    setMapPinError("");
    setGeoResolving(false);
    setDailySpendCap("");
    setEndsAt("");
  }

  const hasMapPin =
    geoLat != null &&
    geoLng != null &&
    Number.isFinite(geoLat) &&
    Number.isFinite(geoLng) &&
    !(geoLat === 0 && geoLng === 0);

  if (!hydrated) {
    return <CampaignListSkeleton columns={7} />;
  }

  if (!token) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--dama-muted)]">
          <SignInLink className="text-[var(--dama-gold)] underline" />
        </p>
      </div>
    );
  }

  if (playbackQuery.isLoading || enumsQuery.isLoading) {
    return <CampaignListSkeleton columns={7} />;
  }

  if (playbackQuery.isError || enumsQuery.isError || !pageChrome) {
    const unavailable = (playbackQuery.data?.schedule_chrome?.playback_unavailable || "").trim();
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

  const searchLabel = (pageChrome.search_campaigns_label || "").trim();
  const searchPlaceholder = (pageChrome.search_campaigns_placeholder || "").trim();
  const statusFilterLabel = (pageChrome.filter_status_label || "").trim();
  const statusAllLabel = (pageChrome.filter_status_all || "").trim();
  const cancelLabel = (pageChrome.cancel_action || "").trim();
  const closeLabel = (pageChrome.dialog_close_label || "").trim();

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {pageChrome.publisher_page_title}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--dama-muted)]">
            {pageChrome.publisher_page_body}
          </p>
        </div>
        <Button
          type="button"
          variant="gold"
          className="gap-2"
          onClick={() => createDialog.openWith(true)}
        >
          <Plus className="h-4 w-4" aria-hidden />
          {pageChrome.create_action}
        </Button>
      </div>

      <div className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] shadow-[var(--dama-card-shadow)]">
        <div className="flex flex-col gap-3 border-b border-[var(--dama-border)] p-4 sm:flex-row sm:items-end sm:justify-between">
          {searchLabel ? (
            <Field id="ads-campaigns-search" label={searchLabel} className="w-full sm:max-w-md">
              <Input
                id="ads-campaigns-search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSkip(0);
                }}
                placeholder={searchPlaceholder}
                autoComplete="off"
              />
            </Field>
          ) : null}
          {campaignStatuses.length > 0 && statusFilterLabel ? (
            <Field id="ads-campaigns-status" label={statusFilterLabel} className="sm:min-w-[12rem]">
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  setSkip(0);
                }}
              >
                <SelectTrigger id="ads-campaigns-status">
                  <SelectValue placeholder={statusFilterLabel} />
                </SelectTrigger>
                <SelectContent>
                  {statusAllLabel ? (
                    <SelectItem value={STATUS_ALL}>{statusAllLabel}</SelectItem>
                  ) : null}
                  {campaignStatuses.map((status) => {
                    const labeled =
                      (enumsQuery.data?.campaign_status_labels?.[status] || "").trim() ||
                      (pageChrome.empty_value || "").trim();
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
        {isLoading ? (
          <div className="p-2">
            <OpsDataTableSkeleton columns={6} rows={6} embedded />
          </div>
        ) : (
          <OpsDataTable
            className="rounded-none border-0"
            columns={campaignColumns}
            data={data ?? []}
            getRowId={(c) => c.id}
            focusedRowId={deepLinkId || undefined}
            isFetching={softFetching || bulkPending}
            meta={listData?.meta}
            onPage={(next) => {
              setRowSelection({});
              setSkip(next);
            }}
            pageDisabled={softFetching || bulkPending}
            pageInputId="ads-campaigns-skip"
            empty={<span>{pageChrome.publisher_no_campaigns}</span>}
            selection={
              (pageChrome.select_all_label || "").trim() &&
              (pageChrome.select_row_label || "").trim()
                ? {
                    chrome: {
                      selectAllLabel: (pageChrome.select_all_label || "").trim(),
                      selectRowLabel: (pageChrome.select_row_label || "").trim(),
                      selectedCountFmt: (pageChrome.selected_count_fmt || "").trim() || undefined,
                    },
                    rowSelection,
                    onRowSelectionChange: setRowSelection,
                    toolbar: (
                      <>
                        {(pageChrome.bulk_apply_status_action || "").trim() &&
                        campaignStatuses.length > 0 ? (
                          <>
                            <Select
                              value={bulkStatus || undefined}
                              onValueChange={setBulkStatus}
                              disabled={bulkPending || selectedRowIds(rowSelection).length === 0}
                            >
                              <SelectTrigger className="w-[10rem]">
                                <SelectValue placeholder={(pageChrome.status_label || "").trim()} />
                              </SelectTrigger>
                              <SelectContent>
                                {campaignStatuses.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {(
                                      enumsQuery.data?.campaign_status_labels?.[status] || ""
                                    ).trim() || status}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={
                                selectedRowIds(rowSelection).length === 0 ||
                                !bulkStatus.trim() ||
                                bulkPending
                              }
                              isLoading={bulkPending}
                              pendingLabel={pageChrome.bulk_status_pending}
                              onClick={() => {
                                const ids = selectedRowIds(rowSelection);
                                const status = bulkStatus.trim();
                                if (!ids.length || !status) return;
                                setBulkPending(true);
                                void (async () => {
                                  try {
                                    for (const id of ids) {
                                      await setStatus.mutateAsync({ id, status });
                                    }
                                    setRowSelection({});
                                    setBulkStatus("");
                                  } finally {
                                    setBulkPending(false);
                                  }
                                })();
                              }}
                            >
                              {pageChrome.bulk_apply_status_action}
                            </Button>
                          </>
                        ) : null}
                        {(pageChrome.clear_selection_action || "").trim() ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={bulkPending}
                            onClick={() => setRowSelection({})}
                          >
                            {pageChrome.clear_selection_action}
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

      <Dialog
        open={createDialog.open}
        onOpenChange={(next) => {
          if (!next) resetCreateForm();
          createDialog.onOpenChange(next);
        }}
      >
        <DialogContent className="max-w-2xl sm:max-w-2xl" closeLabel={closeLabel || undefined}>
          <DialogHeader>
            <DialogTitle>{pageChrome.create_action}</DialogTitle>
            <DialogDescription>{pageChrome.publisher_page_body}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="create-title" label={pageChrome.ph_title} className="sm:col-span-2">
              <Input
                id="create-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={pageChrome.ph_title}
                autoComplete="off"
              />
            </Field>
            {mapChrome ? (
              <div className="sm:col-span-2">
                <LocationPinField
                  latitude={geoLat}
                  longitude={geoLng}
                  onPinChange={handleMapPinChange}
                  onPinClear={handleMapPinClear}
                  pinTitle={(title || pageChrome.create_action || "").trim()}
                  pinId="create-campaign-pin"
                  mapHeightClassName="h-[240px]"
                  required
                  error={mapPinError}
                  chrome={{
                    sectionTitle: mapChrome.map_location_section_title,
                    mapPinEmpty: mapChrome.map_pin_empty,
                    mapPinRequiredHint: mapChrome.map_pin_required,
                    useDeviceLocation: mapChrome.map_use_device_location,
                    clearPin: mapChrome.map_clear_pin,
                    helperText: mapChrome.map_helper_text,
                    geolocationUnavailable: mapChrome.map_geolocation_unavailable,
                    geolocationFailed: mapChrome.map_geolocation_failed,
                    pinCoordsFmt: mapChrome.map_pin_coords_fmt,
                  }}
                />
              </div>
            ) : null}
            <Field id="create-country" label={pageChrome.ph_country}>
              <Input
                id="create-country"
                value={geoCountry ? formatCountryLabel(geoCountry, geoCountryName) : ""}
                readOnly
                placeholder={pageChrome.ph_country}
                autoComplete="country-name"
              />
            </Field>
            <Field id="create-region" label={pageChrome.ph_region}>
              <Input
                id="create-region"
                value={geoRegion}
                readOnly
                placeholder={pageChrome.ph_region}
              />
            </Field>
            <Field id="create-district" label={pageChrome.ph_district}>
              <Input
                id="create-district"
                value={geoDistrict}
                readOnly
                placeholder={pageChrome.ph_district}
              />
            </Field>
            <Field
              id="create-cap"
              label={pageChrome.ph_daily_spend_cap}
              description={(pageChrome.daily_spend_cap_required_hint || "").trim() || undefined}
              className="sm:col-span-2"
            >
              <AmountInput
                id="create-cap"
                value={dailySpendCap}
                onValueChange={setDailySpendCap}
                placeholder={pageChrome.ph_daily_spend_cap}
              />
            </Field>
            {pageChrome.ends_at_label ? (
              <Field
                id="create-ends-at"
                label={pageChrome.ends_at_label}
                description={pageChrome.ends_at_blurb}
                className="sm:col-span-2"
              >
                <DateTimeField
                  id="create-ends-at"
                  value={endsAt}
                  onChange={setEndsAt}
                  placeholder={(pageChrome.ph_ends_at || "").trim()}
                />
              </Field>
            ) : null}
            <div className="sm:col-span-2 space-y-2 rounded-md border border-[var(--dama-border)] p-3 text-sm">
              <p className="font-medium">{pageChrome.campaign_create_fee_label}</p>
              <p className="text-[var(--dama-muted)]">{pageChrome.campaign_create_fee_blurb}</p>
              {createFee != null &&
              createFee > 0 &&
              createFeeCurrency &&
              chromeSeparatorPresent(pageChrome.amount_currency_separator) ? (
                <p className="font-mono text-[var(--dama-gold)]">
                  {createFee}
                  {chromeSeparator(pageChrome.amount_currency_separator)}
                  {createFeeCurrency}
                </p>
              ) : (
                <p className="text-[var(--dama-danger)]">
                  {pageChrome.publisher_pricing_unavailable}
                </p>
              )}
              {needsTopUp ? (
                <div className="space-y-2">
                  <p className="text-[var(--dama-danger)]">
                    {pageChrome.insufficient_campaign_create_fee}
                  </p>
                  {withWalletFocusParam(
                    (pageChrome.publisher_portal_wallet_href || "").trim(),
                    "topup",
                  ) && (pageChrome.publisher_portal_wallet_label || "").trim() ? (
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={withWalletFocusParam(
                          (pageChrome.publisher_portal_wallet_href || "").trim(),
                          "topup",
                        )}
                      >
                        {pageChrome.publisher_portal_wallet_label}
                      </Link>
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            {cancelLabel ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetCreateForm();
                  createDialog.close();
                }}
              >
                {cancelLabel}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="gold"
              disabled={
                !title ||
                !hasMapPin ||
                !geoCountry.trim() ||
                !mapChrome ||
                geoResolving ||
                !defaultCreativeType ||
                !dailyCapOk ||
                needsTopUp ||
                !(createFee != null && createFee > 0) ||
                !createFeeCurrency
              }
              isLoading={create.isPending}
              pendingLabel={pageChrome.create_pending}
              onClick={() => {
                if (!hasMapPin || geoLat == null || geoLng == null) {
                  const req = (mapChrome?.map_pin_required || "").trim();
                  if (req) {
                    setMapPinError(req);
                    toast.error(req);
                  }
                  return;
                }
                if (!dailyCapOk) {
                  const req = (pageChrome.err_daily_spend_cap_required || "").trim();
                  if (req) toast.error(req);
                  return;
                }
                create.mutate(
                  {
                    title,
                    creativeType: defaultCreativeType,
                    geoCountry,
                    geoRegion,
                    geoDistrict,
                    geoLat: String(geoLat),
                    geoLng: String(geoLng),
                    dailySpendCap,
                    endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
                    countryCode: geoCountry.trim().toUpperCase(),
                  },
                  {
                    onSuccess: (created) => {
                      resetCreateForm();
                      createDialog.close();
                      if (created?.id) openDetail(created, { focusMedia: true });
                    },
                  },
                );
              }}
            >
              {pageChrome.create_action}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={detailDialog.open}
        onOpenChange={(next) => {
          if (!next) setMediaFirstInDetail(false);
          detailDialog.onOpenChange(next);
        }}
      >
        <DialogContent className="max-w-2xl sm:max-w-2xl" closeLabel={closeLabel || undefined}>
          <DialogHeader>
            <DialogTitle className="truncate pr-2">
              {(detailLive?.title || "").trim() || (pageChrome.empty_value || "").trim()}
            </DialogTitle>
            <DialogDescription>
              {detailLive
                ? `${(detailLive.status_label || "").trim() || (pageChrome.empty_value || "").trim()}${pageChrome.meta_separator}${(detailLive.creative_type_label || "").trim() || (pageChrome.empty_value || "").trim()}`
                : (pageChrome.empty_value || "").trim()}
            </DialogDescription>
          </DialogHeader>
          {detailLive ? (
            <div className="space-y-4 text-sm">
              <p className="text-[var(--dama-muted)]">
                {typeof detailLive.impressions === "number"
                  ? detailLive.impressions
                  : (pageChrome.empty_value || "").trim()}{" "}
                {pageChrome.stats_impressions_suffix}
                {pageChrome.meta_separator}
                {typeof detailLive.clicks === "number"
                  ? detailLive.clicks
                  : (pageChrome.empty_value || "").trim()}{" "}
                {pageChrome.stats_clicks_suffix}
                {typeof detailLive.unique_reach === "number"
                  ? `${pageChrome.meta_separator}${detailLive.unique_reach} ${pageChrome.stats_reach_suffix}`
                  : ""}
                {detailLive.daily_spend_cap != null &&
                detailLive.daily_spend_cap > 0 &&
                createFeeCurrency &&
                chromeSeparatorPresent(pageChrome.amount_currency_separator)
                  ? `${pageChrome.meta_separator}${pageChrome.daily_spend_cap_suffix} ${detailLive.daily_spend_cap}${chromeSeparator(pageChrome.amount_currency_separator)}${createFeeCurrency}`
                  : ""}
                {detailLive.video_id
                  ? `${pageChrome.meta_separator}${pageChrome.video_attached_suffix}`
                  : ""}
              </p>
              {(() => {
                const mediaBlock =
                  !detailLive.auto_closed &&
                  (viewportCreativesChrome || (mediaChrome && dropzoneChrome)) ? (
                    <div
                      ref={mediaSectionRef}
                      className={
                        mediaFirstInDetail
                          ? "scroll-mt-4 space-y-4"
                          : "scroll-mt-4 space-y-4 border-t border-[var(--dama-border)] pt-4"
                      }
                    >
                      {viewportCreativesChrome ? (
                        <ViewportCreativesEditor
                          campaign={detailLive}
                          chrome={viewportCreativesChrome}
                          token={token}
                        />
                      ) : null}
                      {mediaChrome && dropzoneChrome ? (
                        <CampaignMediaUpload
                          campaign={detailLive}
                          chrome={mediaChrome}
                          dropzoneChrome={dropzoneChrome}
                          token={token}
                          clearLegacyVideoLabel={
                            (detailLive.video_id || "").trim() &&
                            (pageChrome?.clear_legacy_video_action || "").trim()
                              ? pageChrome.clear_legacy_video_action
                              : undefined
                          }
                          clearingLegacyVideo={
                            clearLegacyVideo.isPending &&
                            clearLegacyVideo.variables?.id === detailLive.id
                          }
                          onClearLegacyVideo={() => clearLegacyVideo.mutate({ id: detailLive.id })}
                          uploadingThumb={
                            (uploadThumbnail.isPending &&
                              uploadThumbnail.variables?.id === detailLive.id) ||
                            (clearThumbnail.isPending &&
                              clearThumbnail.variables?.id === detailLive.id)
                          }
                          uploadingGallery={
                            (uploadGallery.isPending &&
                              uploadGallery.variables?.id === detailLive.id) ||
                            (removeGallery.isPending &&
                              removeGallery.variables?.id === detailLive.id)
                          }
                          onThumbnail={(file) =>
                            uploadThumbnail.mutate({ id: detailLive.id, file })
                          }
                          onClearThumbnail={() => clearThumbnail.mutate({ id: detailLive.id })}
                          onGallery={(files) => uploadGallery.mutate({ id: detailLive.id, files })}
                          onRemoveGallery={(index) =>
                            removeGallery.mutate({ id: detailLive.id, index })
                          }
                        />
                      ) : null}
                    </div>
                  ) : null;
                const metaBlock = (
                  <>
                    {!detailLive.auto_closed && !isArchived(detailLive.status) ? (
                      <Field id="detail-campaign-title" label={pageChrome.ph_title}>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                          <Input
                            id="detail-campaign-title"
                            value={detailTitle}
                            onChange={(e) => setDetailTitle(e.target.value)}
                            placeholder={pageChrome.ph_title}
                            className="min-w-0 flex-1"
                            disabled={updateTitle.isPending}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                            disabled={
                              updateTitle.isPending ||
                              !detailTitle.trim() ||
                              detailTitle.trim() === (detailLive.title || "").trim() ||
                              !(pageChrome.save_action || "").trim()
                            }
                            isLoading={updateTitle.isPending}
                            pendingLabel={pageChrome.save_pending}
                            onClick={() =>
                              updateTitle.mutate({
                                id: detailLive.id,
                                title: detailTitle.trim(),
                              })
                            }
                          >
                            {pageChrome.save_action}
                          </Button>
                        </div>
                      </Field>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {campaignStatuses.map((status) => {
                        const label =
                          (enumsQuery.data?.campaign_status_labels?.[status] || "").trim() ||
                          (pageChrome.empty_value || "").trim();
                        return (
                          <Button
                            key={status}
                            size="sm"
                            variant={detailLive.status === status ? "gold" : "outline"}
                            disabled={detailLive.auto_closed || detailLive.status === status}
                            isLoading={
                              setStatus.isPending && setStatus.variables?.id === detailLive.id
                            }
                            pendingLabel={pageChrome.update_status_pending}
                            onClick={() => setStatus.mutate({ id: detailLive.id, status })}
                          >
                            {label}
                          </Button>
                        );
                      })}
                      {!mediaChrome && !viewportCreativesChrome ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!defaultCreativeType || detailLive.auto_closed}
                          isLoading={
                            replaceCreative.isPending &&
                            replaceCreative.variables?.id === detailLive.id
                          }
                          pendingLabel={pageChrome.replace_creative_pending}
                          onClick={() =>
                            replaceCreative.mutate({
                              id: detailLive.id,
                              creativeType: defaultCreativeType,
                            })
                          }
                        >
                          {pageChrome.replace_creative_action}
                        </Button>
                      ) : null}
                      {!viewportCreativesChrome ? (
                        <Button
                          size="sm"
                          variant="gold"
                          disabled={detailLive.auto_closed}
                          isLoading={attachYT.isPending && attachYT.variables === detailLive.id}
                          pendingLabel={pageChrome.attach_video_pending}
                          onClick={() => attachYT.mutate(detailLive.id)}
                        >
                          {pageChrome.attach_video_action}
                        </Button>
                      ) : null}
                    </div>
                    {(() => {
                      const slides = [
                        ...(detailLive.thumbnail_url ? [detailLive.thumbnail_url] : []),
                        ...((detailLive.gallery ?? []).filter(
                          (u) => (u || "").trim().length > 0,
                        ) as string[]),
                      ];
                      return slides.length > 0 && mediaChrome ? (
                        <div className="overflow-hidden rounded-lg border border-[var(--dama-border)]">
                          <GalleryCarousel images={slides} ariaLabel={mediaChrome.gallery_label} />
                        </div>
                      ) : null;
                    })()}
                  </>
                );
                return (
                  <>
                    {mediaFirstInDetail ? mediaBlock : null}
                    {metaBlock}
                    {!mediaFirstInDetail ? mediaBlock : null}
                    {token && !detailLive.auto_closed ? (
                      <PublisherScheduleEditor campaign={detailLive} token={token} />
                    ) : null}
                  </>
                );
              })()}
            </div>
          ) : null}
          {detailLive && pageChrome ? (
            <DialogFooter>
              {pageChrome.close_campaign_action &&
              !detailLive.auto_closed &&
              !isArchived(detailLive.status) ? (
                <Button
                  type="button"
                  variant="outline"
                  isLoading={closeCampaign.isPending && closeCampaign.variables === detailLive.id}
                  pendingLabel={pageChrome.close_campaign_action}
                  onClick={() => closeCampaign.mutate(detailLive.id)}
                >
                  {pageChrome.close_campaign_action}
                </Button>
              ) : null}
              {pageChrome.reopen_campaign_action &&
              isArchived(detailLive.status) &&
              !detailLive.auto_closed ? (
                <Button
                  type="button"
                  variant="outline"
                  isLoading={reopenCampaign.isPending && reopenCampaign.variables === detailLive.id}
                  pendingLabel={pageChrome.reopen_campaign_action}
                  onClick={() => reopenCampaign.mutate(detailLive.id)}
                >
                  {pageChrome.reopen_campaign_action}
                </Button>
              ) : null}
              {(pageChrome.delete_campaign_action || "").trim() &&
              !detailLive.auto_closed &&
              (typeof detailLive.impressions !== "number" || detailLive.impressions === 0) &&
              (typeof detailLive.clicks !== "number" || detailLive.clicks === 0) ? (
                <Button
                  type="button"
                  variant="outline"
                  className="text-[var(--dama-danger)]"
                  onClick={() => setDeleteTarget(detailLive)}
                >
                  {pageChrome.delete_campaign_action}
                </Button>
              ) : null}
              {closeLabel ? (
                <Button type="button" variant="outline" onClick={() => detailDialog.close()}>
                  {closeLabel}
                </Button>
              ) : null}
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-md" closeLabel={closeLabel || undefined}>
          <DialogHeader>
            <DialogTitle>
              {(pageChrome.delete_campaign_confirm_title || "").trim() ||
                (pageChrome.delete_campaign_action || "").trim()}
            </DialogTitle>
            <DialogDescription>
              {(pageChrome.delete_campaign_confirm_description || "").trim()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {cancelLabel ? (
              <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
                {cancelLabel}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="gold"
              disabled={!deleteTarget}
              isLoading={deleteCampaign.isPending && deleteCampaign.variables === deleteTarget?.id}
              pendingLabel={pageChrome.delete_campaign_pending}
              onClick={() => {
                const id = (deleteTarget?.id || "").trim();
                if (!id) return;
                deleteCampaign.mutate(id, {
                  onSuccess: () => {
                    if (detailDialog.value?.id === id) detailDialog.close();
                    setDeleteTarget(null);
                    setRowSelection((prev) => {
                      const next = { ...prev };
                      delete next[id];
                      return next;
                    });
                  },
                });
              }}
            >
              {pageChrome.delete_campaign_action}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CampaignMediaUpload({
  campaign,
  chrome,
  dropzoneChrome,
  clearLegacyVideoLabel,
  clearingLegacyVideo,
  onClearLegacyVideo,
  uploadingThumb,
  uploadingGallery,
  onThumbnail,
  onClearThumbnail,
  onGallery,
  onRemoveGallery,
}: {
  campaign: AdCampaign;
  chrome: AdMediaChrome;
  dropzoneChrome: Required<MediaUploadChrome>;
  token: string | null | undefined;
  clearLegacyVideoLabel?: string;
  clearingLegacyVideo?: boolean;
  onClearLegacyVideo?: () => void;
  uploadingThumb: boolean;
  uploadingGallery: boolean;
  onThumbnail: (file: File) => void;
  onClearThumbnail: () => void;
  onGallery: (files: File[]) => void;
  onRemoveGallery: (index: number) => void;
}) {
  const gallery = (campaign.gallery ?? []).filter((u) => (u || "").trim().length > 0);

  return (
    <div className="space-y-4 border-t border-[var(--dama-border)] pt-4">
      <EntityMediaEditor
        chrome={{
          thumbnail_label: chrome.thumbnail_label,
          gallery_label: chrome.gallery_label,
          gallery_empty: chrome.gallery_empty,
          gallery_add_action: chrome.gallery_add_action,
          gallery_max_slots: chrome.gallery_max_slots,
          gallery_slots_fmt: chrome.gallery_slots_fmt,
          thumbnail_main_badge: chrome.thumbnail_main_badge,
          thumbnail_empty_hint: chrome.thumbnail_empty_hint,
          thumbnail_hint: chrome.thumbnail_hint,
          gallery_limit_reached: chrome.gallery_limit_reached,
          uploading_label: dropzoneChrome.uploading_label,
          remove_action: dropzoneChrome.remove_action,
        }}
        thumbnailUrl={(campaign.thumbnail_url || "").trim()}
        galleryUrls={gallery}
        busyThumbnail={uploadingThumb}
        busyGallery={uploadingGallery}
        onThumbnail={onThumbnail}
        onClearThumbnail={onClearThumbnail}
        onGalleryFiles={onGallery}
        onRemoveGallery={onRemoveGallery}
      />
      {clearLegacyVideoLabel && onClearLegacyVideo ? (
        <div className="border-t border-[var(--dama-border)] pt-4">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={clearingLegacyVideo}
            isLoading={clearingLegacyVideo}
            onClick={onClearLegacyVideo}
          >
            {clearLegacyVideoLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
