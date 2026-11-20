"use client";

import { ViewportCreativesEditor } from "@/components/ads/ViewportCreativesEditor";
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { SignInLink } from "@/components/auth/SignInLink";
import { EntityMediaEditor } from "@/components/media/EntityMediaEditor";
import { GalleryCarousel } from "@/components/media/GalleryCarousel";
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
  AdsPageSkeleton,
  FormCardSkeleton,
  OpsDataTableSkeleton,
} from "@/components/ui/shimmer-skeletons";
import {
  useClearCampaignLegacyVideoMutation,
  useClearCampaignThumbnailMutation,
  useRemoveCampaignGalleryMutation,
  useSaveAdPlaybackMutation,
  useSaveCampaignScheduleMutation,
  useSetConsoleCampaignStatusMutation,
  useUploadCampaignGalleryMutation,
  useUploadCampaignThumbnailMutation,
} from "@/hooks/mutation";
import {
  useAdPlaybackQuery,
  useClientEnumsQuery,
  useConsoleAdCampaignsQuery,
  useMyPermissionsQuery,
} from "@/hooks/query";
import { useMediaUploadChromeQuery } from "@/hooks/query/useMediaUploadChromeQuery";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDeferredDialogValue } from "@/hooks/use-deferred-dialog-selection";
import { useIsConsoleRole } from "@/hooks/useIsConsoleRole";
import { useResetSkipOnChange } from "@/hooks/useResetSkipOnChange";
import { useUrlSkip } from "@/hooks/useUrlSkip";
import { restClient } from "@/lib/api";
import { resolvePublicMediaUrl } from "@/lib/resolve-public-media-url";
import { QueryStale } from "@/lib/query-policy";
import { sanitizeIntegerInput } from "@/lib/sanitize-integer-input";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import type { AdPlayback, AdRuntimeChrome, ConsoleAdCampaign } from "@/types/ad-runtime";
import { isAdMediaChromeReady, isViewportCreativesChromeReady } from "@/types/ad-runtime";
import { type MediaUploadChrome, isMediaUploadChromeReady } from "@/types/media-upload-chrome";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type AdsTab = "runtime" | "campaigns";

function parseListPageSize(raw: string | undefined): number {
  const n = Number.parseInt(String(raw || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function optionalInt(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function campaignCreativeIsImage(creativeType: string, creativeUrl: string): boolean {
  const url = creativeUrl.trim();
  if (!url) return false;
  if ((creativeType || "").trim() === "image") return true;
  return /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(url);
}

function rawCampaignTableThumb(c: ConsoleAdCampaign): string {
  const thumbUrl = (c.thumbnail_url || "").trim();
  if (thumbUrl) return thumbUrl;
  const firstGallery = (c.gallery ?? []).map((u) => (u || "").trim()).find(Boolean);
  if (firstGallery) return firstGallery;
  const creativeUrl = (c.creative_url || "").trim();
  if (campaignCreativeIsImage(c.creative_type, creativeUrl)) return creativeUrl;
  return "";
}

function buildCampaignPreviewUrls(c: ConsoleAdCampaign): string[] {
  const gallery = (c.gallery ?? []).filter((u) => (u || "").trim().length > 0);
  const thumbUrl = (c.thumbnail_url || "").trim();
  const creativeUrl = (c.creative_url || "").trim();
  const includeCreative =
    creativeUrl &&
    campaignCreativeIsImage(c.creative_type, creativeUrl) &&
    creativeUrl !== thumbUrl &&
    !gallery.includes(creativeUrl);
  return [
    ...(thumbUrl ? [thumbUrl] : []),
    ...gallery.filter((u) => u !== thumbUrl),
    ...(includeCreative ? [creativeUrl] : []),
  ];
}

function CampaignMediaUploads({
  campaign,
  chrome,
  dropzoneChrome,
  uploadingThumb,
  uploadingGallery,
  onThumbnail,
  onClearThumbnail,
  onGallery,
  onRemoveGallery,
  showPreview = true,
  disabled = false,
}: {
  campaign: ConsoleAdCampaign;
  chrome: AdRuntimeChrome &
    Required<
      Pick<
        AdRuntimeChrome,
        | "thumbnail_label"
        | "gallery_label"
        | "gallery_empty"
        | "gallery_add_action"
        | "gallery_max_slots"
        | "gallery_slots_fmt"
        | "thumbnail_main_badge"
        | "thumbnail_empty_hint"
        | "thumbnail_hint"
        | "gallery_limit_reached"
      >
    >;
  dropzoneChrome: Required<MediaUploadChrome>;
  uploadingThumb: boolean;
  uploadingGallery: boolean;
  onThumbnail: (file: File) => void;
  onClearThumbnail: () => void;
  onGallery: (files: File[]) => void;
  onRemoveGallery: (index: number) => void;
  showPreview?: boolean;
  disabled?: boolean;
}) {
  const preview = buildCampaignPreviewUrls(campaign).map(resolvePublicMediaUrl).filter(Boolean);
  const gallery = (campaign.gallery ?? []).filter((u) => (u || "").trim().length > 0);

  return (
    <div className="mt-4 space-y-4 border-t border-[var(--dama-border)] pt-4">
      {showPreview && preview.length > 0 ? (
        <GalleryCarousel images={preview} ariaLabel={chrome.gallery_label} />
      ) : null}
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
        disabled={disabled}
      />
    </div>
  );
}

function CampaignScheduleEditor({
  campaign,
  chrome,
  bounds,
  statuses,
  statusLabels,
  token,
  enumsReady,
  compactHeader,
}: {
  campaign: ConsoleAdCampaign;
  chrome: AdRuntimeChrome;
  bounds: Pick<
    AdPlayback,
    | "non_skippable_min"
    | "non_skippable_max"
    | "first_show_min"
    | "first_show_max"
    | "interval_min"
    | "interval_max"
    | "impression_cap_min"
  >;
  statuses: string[];
  statusLabels: Record<string, string>;
  token: string | null | undefined;
  enumsReady: boolean;
  compactHeader?: boolean;
}) {
  const [enabled, setEnabled] = useState(campaign.schedule_enabled);
  const [firstShow, setFirstShow] = useState(
    campaign.first_show_after_seconds != null ? String(campaign.first_show_after_seconds) : "",
  );
  const [interval, setIntervalSec] = useState(
    campaign.interval_seconds != null ? String(campaign.interval_seconds) : "",
  );
  const [nonSkip, setNonSkip] = useState(
    campaign.non_skippable_seconds != null ? String(campaign.non_skippable_seconds) : "",
  );
  const [daily, setDaily] = useState(
    campaign.daily_impression_cap != null ? String(campaign.daily_impression_cap) : "",
  );
  const [weekly, setWeekly] = useState(
    campaign.weekly_impression_cap != null ? String(campaign.weekly_impression_cap) : "",
  );
  const [monthly, setMonthly] = useState(
    campaign.monthly_impression_cap != null ? String(campaign.monthly_impression_cap) : "",
  );
  const [yearly, setYearly] = useState(
    campaign.yearly_impression_cap != null ? String(campaign.yearly_impression_cap) : "",
  );
  const [status, setStatus] = useState(campaign.status);

  const saveSchedule = useSaveCampaignScheduleMutation(token);
  const setCampaignStatus = useSetConsoleCampaignStatusMutation(token);
  const uploadThumbnail = useUploadCampaignThumbnailMutation(token);
  const clearThumbnail = useClearCampaignThumbnailMutation(token);
  const uploadGallery = useUploadCampaignGalleryMutation(token);
  const removeGallery = useRemoveCampaignGalleryMutation(token);
  const clearLegacyVideo = useClearCampaignLegacyVideoMutation(token);
  const mediaChrome = isAdMediaChromeReady(chrome) ? chrome : undefined;
  const viewportCreativesChrome = isViewportCreativesChromeReady(chrome) ? chrome : undefined;
  const mediaLocked = Boolean(campaign.auto_closed);
  const legacyVideoId = (campaign.video_id || "").trim();
  const clearLegacyLabel = (chrome.clear_legacy_video_action || "").trim();
  const mediaUploadChromeQuery = useMediaUploadChromeQuery(Boolean(token));
  const dropzoneChrome = isMediaUploadChromeReady(mediaUploadChromeQuery.data)
    ? mediaUploadChromeQuery.data
    : undefined;
  const schedulePreview = buildCampaignPreviewUrls(campaign)
    .map(resolvePublicMediaUrl)
    .filter(Boolean);
  const scheduleGalleryAria = (chrome.gallery_label || "").trim();

  useEffect(() => {
    setEnabled(campaign.schedule_enabled);
    setFirstShow(
      campaign.first_show_after_seconds != null ? String(campaign.first_show_after_seconds) : "",
    );
    setIntervalSec(campaign.interval_seconds != null ? String(campaign.interval_seconds) : "");
    setNonSkip(
      campaign.non_skippable_seconds != null ? String(campaign.non_skippable_seconds) : "",
    );
    setDaily(campaign.daily_impression_cap != null ? String(campaign.daily_impression_cap) : "");
    setWeekly(campaign.weekly_impression_cap != null ? String(campaign.weekly_impression_cap) : "");
    setMonthly(
      campaign.monthly_impression_cap != null ? String(campaign.monthly_impression_cap) : "",
    );
    setYearly(campaign.yearly_impression_cap != null ? String(campaign.yearly_impression_cap) : "");
    setStatus(campaign.status);
  }, [campaign]);

  return (
    <article className="space-y-3">
      {compactHeader ? null : (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="font-semibold">{campaign.title}</h3>
            <p className="text-xs text-[var(--dama-muted)]">
              {(campaign.status_label || "").trim() || (chrome.empty_value || "").trim()}
              {chrome.meta_separator}
              {(campaign.creative_type_label || "").trim() || (chrome.empty_value || "").trim()}
            </p>
          </div>
          <p className="text-xs text-[var(--dama-muted)]">
            {typeof campaign.impressions === "number"
              ? campaign.impressions
              : (chrome.empty_value || "").trim()}
            {chrome.meta_separator}
            {typeof campaign.clicks === "number"
              ? campaign.clicks
              : (chrome.empty_value || "").trim()}
          </p>
        </div>
      )}

      <Field id={`${campaign.id}-enabled`} label={chrome.schedule_enabled_label}>
        <div className="flex min-h-10 items-center gap-2 pt-1">
          <Checkbox
            id={`${campaign.id}-enabled`}
            checked={enabled}
            onCheckedChange={(v) => setEnabled(v === true)}
          />
        </div>
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={`${campaign.id}-first-show`} label={chrome.first_show_label}>
          <Input
            id={`${campaign.id}-first-show`}
            type="number"
            min={bounds.first_show_min}
            max={bounds.first_show_max}
            value={firstShow}
            onChange={(e) => setFirstShow(sanitizeIntegerInput(e.target.value))}
            inputMode="numeric"
            placeholder={chrome.platform_default_placeholder}
          />
        </Field>
        <Field id={`${campaign.id}-interval`} label={chrome.interval_label}>
          <Input
            id={`${campaign.id}-interval`}
            type="number"
            min={bounds.interval_min}
            max={bounds.interval_max}
            value={interval}
            onChange={(e) => setIntervalSec(sanitizeIntegerInput(e.target.value))}
            inputMode="numeric"
            placeholder={chrome.platform_default_placeholder}
          />
        </Field>
        <Field id={`${campaign.id}-nonskip`} label={chrome.non_skippable_label}>
          <Input
            id={`${campaign.id}-nonskip`}
            type="number"
            min={bounds.non_skippable_min}
            max={bounds.non_skippable_max}
            value={nonSkip}
            onChange={(e) => setNonSkip(sanitizeIntegerInput(e.target.value))}
            inputMode="numeric"
            placeholder={chrome.platform_default_placeholder}
          />
        </Field>
        <Field id={`${campaign.id}-status`} label={chrome.status_label}>
          <Select
            value={status}
            onValueChange={setStatus}
            disabled={!enumsReady || statuses.length === 0}
          >
            <SelectTrigger id={`${campaign.id}-status`}>
              <SelectValue placeholder={chrome.status_label} />
            </SelectTrigger>
            <SelectContent>
              {statuses
                .map((s) => ({ value: s, label: (statusLabels[s] || "").trim() }))
                .filter((o) => Boolean(o.label))
                .map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id={`${campaign.id}-daily`} label={chrome.daily_cap_label}>
          <Input
            id={`${campaign.id}-daily`}
            type="number"
            min={bounds.impression_cap_min}
            value={daily}
            onChange={(e) => setDaily(sanitizeIntegerInput(e.target.value))}
            inputMode="numeric"
            placeholder={chrome.unlimited_cap_placeholder}
          />
        </Field>
        <Field id={`${campaign.id}-weekly`} label={chrome.weekly_cap_label}>
          <Input
            id={`${campaign.id}-weekly`}
            type="number"
            min={bounds.impression_cap_min}
            value={weekly}
            onChange={(e) => setWeekly(sanitizeIntegerInput(e.target.value))}
            inputMode="numeric"
            placeholder={chrome.unlimited_cap_placeholder}
          />
        </Field>
        <Field id={`${campaign.id}-monthly`} label={chrome.monthly_cap_label}>
          <Input
            id={`${campaign.id}-monthly`}
            type="number"
            min={bounds.impression_cap_min}
            value={monthly}
            onChange={(e) => setMonthly(sanitizeIntegerInput(e.target.value))}
            inputMode="numeric"
            placeholder={chrome.unlimited_cap_placeholder}
          />
        </Field>
        <Field id={`${campaign.id}-yearly`} label={chrome.yearly_cap_label}>
          <Input
            id={`${campaign.id}-yearly`}
            type="number"
            min={bounds.impression_cap_min}
            value={yearly}
            onChange={(e) => setYearly(sanitizeIntegerInput(e.target.value))}
            inputMode="numeric"
            placeholder={chrome.unlimited_cap_placeholder}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          isLoading={saveSchedule.isPending}
          pendingLabel={chrome.save_campaign_schedule_pending}
          onClick={() =>
            saveSchedule.mutate({
              id: campaign.id,
              schedule: {
                schedule_enabled: enabled,
                first_show_after_seconds: optionalInt(firstShow),
                interval_seconds: optionalInt(interval),
                non_skippable_seconds: optionalInt(nonSkip),
                daily_impression_cap: optionalInt(daily),
                weekly_impression_cap: optionalInt(weekly),
                monthly_impression_cap: optionalInt(monthly),
                yearly_impression_cap: optionalInt(yearly),
              },
            })
          }
        >
          {chrome.save_campaign_schedule_action}
        </Button>
        <Button
          variant="outline"
          isLoading={setCampaignStatus.isPending}
          pendingLabel={chrome.update_status_pending}
          disabled={!enumsReady || status === campaign.status || statuses.length === 0}
          onClick={() => setCampaignStatus.mutate({ id: campaign.id, status })}
        >
          {chrome.update_status_action}
        </Button>
      </div>

      {schedulePreview.length > 0 && scheduleGalleryAria ? (
        <div className="mt-4 border-t border-[var(--dama-border)] pt-4">
          <GalleryCarousel images={schedulePreview} ariaLabel={scheduleGalleryAria} />
        </div>
      ) : null}
      {mediaChrome && dropzoneChrome ? (
        <>
          <CampaignMediaUploads
            campaign={campaign}
            chrome={mediaChrome}
            dropzoneChrome={dropzoneChrome}
            showPreview={false}
            disabled={mediaLocked}
            uploadingThumb={
              (uploadThumbnail.isPending && uploadThumbnail.variables?.id === campaign.id) ||
              (clearThumbnail.isPending && clearThumbnail.variables?.id === campaign.id)
            }
            uploadingGallery={
              (uploadGallery.isPending && uploadGallery.variables?.id === campaign.id) ||
              (removeGallery.isPending && removeGallery.variables?.id === campaign.id)
            }
            onThumbnail={(file) => uploadThumbnail.mutate({ id: campaign.id, file })}
            onClearThumbnail={() => clearThumbnail.mutate({ id: campaign.id })}
            onGallery={(files) => uploadGallery.mutate({ id: campaign.id, files })}
            onRemoveGallery={(index) => removeGallery.mutate({ id: campaign.id, index })}
          />
          {viewportCreativesChrome ? (
            <ViewportCreativesEditor
              campaign={campaign}
              chrome={viewportCreativesChrome}
              token={token}
              disabled={mediaLocked}
            />
          ) : null}
          {legacyVideoId && clearLegacyLabel && !mediaLocked ? (
            <div className="border-t border-[var(--dama-border)] pt-4">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={clearLegacyVideo.isPending}
                isLoading={
                  clearLegacyVideo.isPending && clearLegacyVideo.variables?.id === campaign.id
                }
                onClick={() => clearLegacyVideo.mutate({ id: campaign.id })}
              >
                {clearLegacyLabel}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </article>
  );
}

function CampaignDetailReadonly({
  campaign,
  chrome,
}: {
  campaign: ConsoleAdCampaign;
  chrome: AdRuntimeChrome;
}) {
  const empty = (chrome.empty_value || "").trim();
  const previewRaw = buildCampaignPreviewUrls(campaign);
  const preview = previewRaw.map(resolvePublicMediaUrl).filter(Boolean);
  const galleryAria = (chrome.gallery_label || "").trim();
  const galleryEmpty = (chrome.gallery_empty || "").trim();
  const rows: { label: string; value: string }[] = [
    { label: chrome.status_label, value: (campaign.status_label || "").trim() || empty },
    {
      label: chrome.first_show_label,
      value:
        campaign.first_show_after_seconds != null
          ? String(campaign.first_show_after_seconds)
          : empty,
    },
    {
      label: chrome.interval_label,
      value: campaign.interval_seconds != null ? String(campaign.interval_seconds) : empty,
    },
    {
      label: chrome.non_skippable_label,
      value:
        campaign.non_skippable_seconds != null ? String(campaign.non_skippable_seconds) : empty,
    },
    {
      label: chrome.daily_cap_label,
      value: campaign.daily_impression_cap != null ? String(campaign.daily_impression_cap) : empty,
    },
    {
      label: chrome.weekly_cap_label,
      value:
        campaign.weekly_impression_cap != null ? String(campaign.weekly_impression_cap) : empty,
    },
    {
      label: chrome.monthly_cap_label,
      value:
        campaign.monthly_impression_cap != null ? String(campaign.monthly_impression_cap) : empty,
    },
    {
      label: chrome.yearly_cap_label,
      value:
        campaign.yearly_impression_cap != null ? String(campaign.yearly_impression_cap) : empty,
    },
    {
      label: (chrome.publisher_stat_impressions || "").trim(),
      value: typeof campaign.impressions === "number" ? String(campaign.impressions) : empty,
    },
    {
      label: (chrome.publisher_stat_clicks || "").trim(),
      value: typeof campaign.clicks === "number" ? String(campaign.clicks) : empty,
    },
    {
      label: (chrome.daily_spend_cap_label || "").trim(),
      value:
        campaign.daily_spend_cap != null && campaign.daily_spend_cap > 0
          ? String(campaign.daily_spend_cap)
          : empty,
    },
    {
      label: (chrome.video_id_label || "").trim(),
      value: (campaign.video_id || "").trim() || empty,
    },
    {
      label: (chrome.creative_url_label || "").trim(),
      value: (campaign.creative_url || "").trim() || empty,
    },
    {
      label: (chrome.created_at_label || "").trim(),
      value: (campaign.created_at || "").trim() || empty,
    },
  ].filter((r) => Boolean(r.label));

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--dama-muted)]">
        {(campaign.creative_type_label || "").trim() || empty}
      </p>
      {(chrome.publisher_id_label || "").trim() ? (
        <div className="min-w-0">
          <p className="text-xs text-[var(--dama-muted)]">
            {(chrome.publisher_id_label || "").trim()}
          </p>
          <p className="break-all text-sm font-medium">
            {(campaign.publisher_id || "").trim() || empty}
          </p>
        </div>
      ) : null}
      {preview.length > 0 ? (
        <GalleryCarousel images={preview} ariaLabel={galleryAria} />
      ) : preview.length === 0 && galleryEmpty ? (
        <p className="text-xs text-[var(--dama-muted)]">{galleryEmpty}</p>
      ) : null}
      <Field id={`${campaign.id}-schedule-enabled-ro`} label={chrome.schedule_enabled_label}>
        <div className="flex min-h-10 items-center gap-2 pt-1">
          <Checkbox
            id={`${campaign.id}-schedule-enabled-ro`}
            checked={campaign.schedule_enabled}
            disabled
          />
        </div>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="min-w-0">
            <p className="text-xs text-[var(--dama-muted)]">{r.label}</p>
            <p className="break-all text-sm">{r.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ConsoleAdsRuntimePage() {
  const token = useAuthStore((s) => s.token);
  const searchParams = useSearchParams();
  const focusCampaignId = (searchParams.get("id") || "").trim();
  const campaignFocusOpened = useRef("");
  const { isConsole: isAdmin, isLoading: roleLoading } = useIsConsoleRole();
  const permsQuery = useMyPermissionsQuery(token, isAdmin);
  const runtimeKey = permsQuery.data?.ads_chrome?.runtime_permission_key ?? "";
  const campaignsKey = permsQuery.data?.ads_chrome?.campaigns_permission_key ?? "";
  const canRuntime =
    Boolean(runtimeKey) && permsQuery.data?.permissions?.includes(runtimeKey) === true;
  const canCampaigns =
    Boolean(campaignsKey) && permsQuery.data?.permissions?.includes(campaignsKey) === true;

  const [tab, setTab] = useState<AdsTab>("runtime");
  const adsTabDefaulted = useRef(false);

  const [campaignSkip, setCampaignSkip] = useUrlSkip("campaign_skip");
  const [rowSelection, setRowSelection] = useState<OpsRowSelectionState>({});
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("");
  const [campaignSearch, setCampaignSearch] = useState("");
  const debouncedSearch = useDebouncedValue(campaignSearch.trim(), 250);
  const [statusFilter, setStatusFilter] = useState("");
  useResetSkipOnChange(setCampaignSkip, [debouncedSearch, statusFilter]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: clear selection when list context changes
  useEffect(() => {
    setRowSelection({});
  }, [debouncedSearch, statusFilter, campaignSkip]);
  const setCampaignStatus = useSetConsoleCampaignStatusMutation(token);

  async function bulkCampaignStatus(status: string) {
    const ids = selectedRowIds(rowSelection);
    const st = (status || "").trim();
    if (!ids.length || !st) return;
    setBulkPending(true);
    try {
      for (const id of ids) {
        await setCampaignStatus.mutateAsync({ id, status: st });
      }
      setRowSelection({});
    } finally {
      setBulkPending(false);
    }
  }

  const detailDialog = useDeferredDialogValue<ConsoleAdCampaign>();
  const editDialog = useDeferredDialogValue<ConsoleAdCampaign>();
  const openDetail = useCallback(
    (c: ConsoleAdCampaign) => detailDialog.openWith(c),
    [detailDialog.openWith],
  );
  const openEdit = useCallback(
    (c: ConsoleAdCampaign) => editDialog.openWith(c),
    [editDialog.openWith],
  );

  const playbackQuery = useAdPlaybackQuery(token, isAdmin && canRuntime);
  const pageSizeQuery = useQuery({
    staleTime: QueryStale.session,
    queryKey: ["ads-playback-list-page-size"],
    enabled: isAdmin && canCampaigns,
    queryFn: async () => {
      const { data } = await restClient.get<{
        schedule_chrome?: { list_page_size?: string };
      }>("/ads/playback");
      return parseListPageSize(data?.schedule_chrome?.list_page_size);
    },
  });
  const pageSize =
    pageSizeQuery.data && pageSizeQuery.data > 0
      ? pageSizeQuery.data
      : parseListPageSize(playbackQuery.data?.chrome?.list_page_size);
  const campaignsQuery = useConsoleAdCampaignsQuery(
    token,
    isAdmin && canCampaigns && pageSize > 0,
    campaignSkip,
    pageSize,
    { q: debouncedSearch, status: statusFilter },
  );
  const enumsQuery = useClientEnumsQuery();
  const savePlayback = useSaveAdPlaybackMutation(token);

  const [nonSkip, setNonSkip] = useState<number | null>(null);
  const [firstShow, setFirstShow] = useState<number | null>(null);
  const [interval, setIntervalSec] = useState<number | null>(null);

  useEffect(() => {
    if (!playbackQuery.data) return;
    setNonSkip(playbackQuery.data.playback.non_skippable_seconds);
    setFirstShow(playbackQuery.data.playback.first_show_after_game_seconds);
    setIntervalSec(playbackQuery.data.playback.default_interval_seconds);
  }, [playbackQuery.data]);

  useEffect(() => {
    if (!canRuntime && !canCampaigns) return;
    if (!adsTabDefaulted.current) {
      adsTabDefaulted.current = true;
      setTab(canRuntime ? "runtime" : "campaigns");
      return;
    }
    if (tab === "runtime" && !canRuntime && canCampaigns) setTab("campaigns");
    if (tab === "campaigns" && !canCampaigns && canRuntime) setTab("runtime");
  }, [canRuntime, canCampaigns, tab]);

  useEffect(() => {
    if (focusCampaignId && canCampaigns) setTab("campaigns");
  }, [focusCampaignId, canCampaigns]);

  useEffect(() => {
    if (!focusCampaignId) {
      campaignFocusOpened.current = "";
      return;
    }
    if (!token || !canCampaigns || campaignFocusOpened.current === focusCampaignId) return;
    const rows = campaignsQuery.data?.campaigns ?? [];
    const hit = rows.find((c) => c.id === focusCampaignId);
    if (hit) {
      campaignFocusOpened.current = focusCampaignId;
      openDetail(hit);
      return;
    }
    if (campaignsQuery.isLoading || campaignsQuery.isFetching) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await restClient.get<ConsoleAdCampaign>(
          `/console/ads/campaigns/${encodeURIComponent(focusCampaignId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (cancelled || !data?.id) return;
        campaignFocusOpened.current = focusCampaignId;
        openDetail(data);
      } catch {
        if (!cancelled) campaignFocusOpened.current = focusCampaignId;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    focusCampaignId,
    token,
    canCampaigns,
    campaignsQuery.data?.campaigns,
    campaignsQuery.isLoading,
    campaignsQuery.isFetching,
    openDetail,
  ]);

  const chrome = playbackQuery.data?.chrome ?? campaignsQuery.data?.chrome;
  const campaignChrome = campaignsQuery.data?.chrome;
  const campaignBounds = campaignsQuery.data?.bounds;
  const campaignRows = campaignsQuery.data?.campaigns ?? [];

  const detailLive = useMemo(() => {
    if (!detailDialog.value) return null;
    return campaignRows.find((c) => c.id === detailDialog.value?.id) ?? detailDialog.value;
  }, [campaignRows, detailDialog.value]);

  const editLive = useMemo(() => {
    if (!editDialog.value) return null;
    return campaignRows.find((c) => c.id === editDialog.value?.id) ?? editDialog.value;
  }, [campaignRows, editDialog.value]);

  const campaignColumns = useMemo((): OpsColumn<ConsoleAdCampaign>[] => {
    if (!chrome || !campaignChrome || !campaignBounds) return [];
    const titleHeader = (chrome.col_title || "").trim();
    const statusHeader = (chrome.status_label || "").trim();
    const perfHeader = [
      (chrome.publisher_stat_impressions || "").trim(),
      (chrome.publisher_stat_clicks || "").trim(),
    ]
      .filter(Boolean)
      .join(chrome.meta_separator);
    const viewLabel = (chrome.view_action || "").trim();
    const editLabel = (chrome.edit_action || "").trim();
    const actionsLabel = (chrome.row_actions_label || "").trim();
    const empty = (chrome.empty_value || "").trim();
    const thumbHeader = (chrome.thumbnail_label || "").trim();
    const cols: OpsColumn<ConsoleAdCampaign>[] = [
      {
        id: "title",
        header: titleHeader,
        cell: (c) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{c.title}</p>
            <p className="mt-0.5 truncate text-xs text-[var(--dama-muted)]">
              {(c.creative_type_label || "").trim() || empty}
            </p>
          </div>
        ),
      },
      {
        id: "status",
        header: statusHeader,
        className: "w-28",
        cell: (c) => <span className="text-sm">{(c.status_label || "").trim() || empty}</span>,
      },
      {
        id: "stats",
        header: perfHeader,
        className: "w-36",
        cell: (c) => (
          <span className="text-xs tabular-nums text-[var(--dama-muted)]">
            {typeof c.impressions === "number" ? c.impressions : empty}
            {chrome.meta_separator}
            {typeof c.clicks === "number" ? c.clicks : empty}
          </span>
        ),
      },
    ];
    if (thumbHeader) {
      cols.unshift({
        id: "thumb",
        header: thumbHeader,
        className: "w-14",
        cell: (c) => {
          const src = resolvePublicMediaUrl(rawCampaignTableThumb(c));
          if (!src) {
            return <span className="text-xs text-[var(--dama-muted)]">{empty}</span>;
          }
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              className="h-10 w-10 shrink-0 rounded-md object-cover bg-[var(--dama-surface)]"
            />
          );
        },
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
        className: "w-12 text-right",
        cell: (c) => (
          <OpsDataTableRowActions
            triggerLabel={actionsLabel}
            actions={[
              ...(viewLabel
                ? [{ id: "view", label: viewLabel, onSelect: () => openDetail(c) }]
                : []),
              ...(editLabel ? [{ id: "edit", label: editLabel, onSelect: () => openEdit(c) }] : []),
            ]}
          />
        ),
      });
    }
    return cols.filter((col) => Boolean(col.header.trim()) || col.id === "actions");
  }, [campaignBounds, campaignChrome, chrome, openDetail, openEdit]);

  if (roleLoading || (isAdmin && permsQuery.isLoading)) {
    return (
      <div className="space-y-6">
        <AdsPageSkeleton tab={tab} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <p className="rounded-md border border-[var(--dama-border)] p-4 text-sm">
          <SignInLink className="text-[var(--dama-gold)] underline" />
        </p>
      </div>
    );
  }

  if (!canRuntime && !canCampaigns) {
    const lacks =
      (permsQuery.data?.ads_chrome?.lacks_permissions || "").trim() ||
      (permsQuery.data?.ads_chrome?.unavailable || "").trim();
    return (
      <div className="space-y-6">
        {lacks ? (
          <output className="block text-sm text-[var(--dama-muted)]" data-error="ads_perms">
            {lacks}
          </output>
        ) : null}
      </div>
    );
  }

  if (
    (canRuntime &&
      playbackQuery.isFetched &&
      (playbackQuery.error || !playbackQuery.data?.chrome)) ||
    (canCampaigns &&
      !canRuntime &&
      campaignsQuery.isFetched &&
      (campaignsQuery.error || !campaignsQuery.data?.chrome))
  ) {
    const unavailable =
      (playbackQuery.data?.chrome?.playback_unavailable || "").trim() ||
      (campaignsQuery.data?.chrome?.playback_unavailable || "").trim();
    return (
      <div className="space-y-6">
        {unavailable ? (
          <p
            className="text-sm text-[var(--dama-danger)]"
            role="alert"
            data-error="ad_runtime_chrome"
          >
            {unavailable}
          </p>
        ) : null}
      </div>
    );
  }

  if (!chrome && (playbackQuery.isLoading || campaignsQuery.isLoading)) {
    return (
      <div className="space-y-6">
        <AdsPageSkeleton tab={tab} />
      </div>
    );
  }

  if (!chrome) {
    const unavailable =
      (playbackQuery.data?.chrome?.playback_unavailable || "").trim() ||
      (campaignsQuery.data?.chrome?.playback_unavailable || "").trim();
    return (
      <div className="space-y-6">
        {unavailable ? (
          <p
            className="text-sm text-[var(--dama-danger)]"
            role="alert"
            data-error="ad_runtime_chrome"
          >
            {unavailable}
          </p>
        ) : null}
      </div>
    );
  }

  const searchLabel = (chrome.search_campaigns_label || "").trim();
  const searchPlaceholder = (chrome.search_campaigns_placeholder || "").trim();
  const statusFilterLabel = (chrome.filter_status_label || "").trim();
  const statusAllLabel = (chrome.filter_status_all || "").trim();
  const closeLabel = (chrome.dialog_close_label || "").trim();
  const cancelLabel = (chrome.cancel_action || "").trim();
  const editLabel = (chrome.edit_action || "").trim();
  const viewLabel = (chrome.view_action || "").trim();
  const campaignStatuses = enumsQuery.data?.campaign_statuses ?? [];
  const statusLabels = enumsQuery.data?.campaign_status_labels ?? {};

  const tabRuntimeLabel = (chrome.section_title || "").trim();
  const tabCampaignsLabel = (chrome.campaigns_title || "").trim();
  const adsTabs = (
    [
      ...(canRuntime ? ([{ id: "runtime" as const, label: tabRuntimeLabel }] as const) : []),
      ...(canCampaigns ? ([{ id: "campaigns" as const, label: tabCampaignsLabel }] as const) : []),
    ] as const
  ).filter((t) => Boolean(t.label));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{chrome.section_title}</h1>
        <p className="mt-1 text-sm text-[var(--dama-muted)]">{chrome.page_body}</p>
      </div>

      {adsTabs.length > 0 ? (
        <div
          role="tablist"
          aria-label={(chrome.section_title || "").trim() || undefined}
          className="flex max-w-full flex-wrap gap-1 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-surface)] p-1"
        >
          {adsTabs.map((t) => (
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
      ) : null}

      {tab === "runtime" && canRuntime ? (
        <section className="space-y-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
          {playbackQuery.isLoading ? (
            <FormCardSkeleton />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field id="ads-runtime-nonskip" label={chrome.non_skippable_label}>
                  <Input
                    id="ads-runtime-nonskip"
                    type="number"
                    min={playbackQuery.data?.playback.non_skippable_min}
                    max={playbackQuery.data?.playback.non_skippable_max}
                    value={nonSkip ?? ""}
                    onChange={(e) => {
                      const digits = sanitizeIntegerInput(e.target.value);
                      setNonSkip(digits === "" ? null : Number(digits));
                    }}
                    inputMode="numeric"
                    placeholder={chrome.platform_default_placeholder}
                    disabled={savePlayback.isPending || nonSkip == null}
                  />
                </Field>
                <Field id="ads-runtime-first-show" label={chrome.first_show_label}>
                  <Input
                    id="ads-runtime-first-show"
                    type="number"
                    min={playbackQuery.data?.playback.first_show_min}
                    max={playbackQuery.data?.playback.first_show_max}
                    value={firstShow ?? ""}
                    onChange={(e) => {
                      const digits = sanitizeIntegerInput(e.target.value);
                      setFirstShow(digits === "" ? null : Number(digits));
                    }}
                    inputMode="numeric"
                    placeholder={chrome.platform_default_placeholder}
                    disabled={savePlayback.isPending || firstShow == null}
                  />
                </Field>
                <Field id="ads-runtime-interval" label={chrome.interval_label}>
                  <Input
                    id="ads-runtime-interval"
                    type="number"
                    min={playbackQuery.data?.playback.interval_min}
                    max={playbackQuery.data?.playback.interval_max}
                    value={interval ?? ""}
                    onChange={(e) => {
                      const digits = sanitizeIntegerInput(e.target.value);
                      setIntervalSec(digits === "" ? null : Number(digits));
                    }}
                    inputMode="numeric"
                    placeholder={chrome.platform_default_placeholder}
                    disabled={savePlayback.isPending || interval == null}
                  />
                </Field>
              </div>
              <Button
                isLoading={savePlayback.isPending}
                pendingLabel={chrome.save_pending}
                disabled={nonSkip == null || firstShow == null || interval == null}
                onClick={() => {
                  if (nonSkip == null || firstShow == null || interval == null) return;
                  savePlayback.mutate({
                    non_skippable_seconds: nonSkip,
                    first_show_after_game_seconds: firstShow,
                    default_interval_seconds: interval,
                  });
                }}
              >
                {chrome.save_action}
              </Button>
            </>
          )}
        </section>
      ) : null}

      {tab === "campaigns" && canCampaigns ? (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--dama-muted)]">
            {chrome.campaigns_title}
          </h2>
          {campaignsQuery.isLoading ? (
            <OpsDataTableSkeleton columns={4} rows={6} showSelection />
          ) : campaignsQuery.error ||
            !campaignsQuery.data?.chrome ||
            !campaignsQuery.data?.bounds ? (
            <p className="text-sm text-[var(--dama-danger)]">{chrome.load_campaigns_failed}</p>
          ) : (
            <>
              <AdminFilterBar
                filters={[
                  {
                    kind: "search",
                    id: "admin-ads-campaigns-search",
                    label: searchLabel,
                    value: campaignSearch,
                    onChange: setCampaignSearch,
                    placeholder: searchPlaceholder || undefined,
                  },
                  {
                    kind: "select",
                    id: "admin-ads-campaigns-status",
                    label: statusFilterLabel,
                    value: statusFilter,
                    onChange: setStatusFilter,
                    allLabel: (statusAllLabel || "").trim() || undefined,
                    options: campaignStatuses
                      .map((s) => ({
                        value: s,
                        label: (statusLabels[s] || "").trim(),
                      }))
                      .filter((o) => Boolean(o.label)),
                  },
                ]}
              />
              <OpsDataTable
                columns={campaignColumns}
                data={campaignRows}
                getRowId={(c) => c.id}
                bodyRowClassName={(c) =>
                  focusCampaignId && c.id === focusCampaignId
                    ? "bg-[var(--dama-gold)]/10 ring-1 ring-inset ring-[var(--dama-gold)]"
                    : undefined
                }
                isFetching={campaignsQuery.isFetching && !campaignsQuery.isLoading}
                meta={campaignsQuery.data.meta}
                onPage={(next) => {
                  setCampaignSkip(next);
                  setRowSelection({});
                }}
                pageDisabled={
                  (campaignsQuery.isFetching && !campaignsQuery.isLoading) || bulkPending
                }
                pageInputId="admin-ads-campaigns-skip"
                empty={<span>{chrome.no_campaigns}</span>}
                selection={{
                  chrome: {
                    selectAllLabel: (chrome.select_all_label || "").trim(),
                    selectRowLabel: (chrome.select_row_label || "").trim(),
                    selectedCountFmt: (chrome.selected_count_fmt || "").trim(),
                  },
                  rowSelection,
                  onRowSelectionChange: setRowSelection,
                  toolbar: (
                    <div className="flex flex-wrap items-center gap-2">
                      {(chrome.update_status_action || "").trim() && campaignStatuses.length > 0 ? (
                        <>
                          <Select
                            value={bulkStatus || undefined}
                            onValueChange={setBulkStatus}
                            disabled={bulkPending || selectedRowIds(rowSelection).length === 0}
                          >
                            <SelectTrigger className="h-9 w-[10.5rem]">
                              <SelectValue placeholder={(chrome.status_label || "").trim()} />
                            </SelectTrigger>
                            <SelectContent>
                              {campaignStatuses
                                .map((s) => ({
                                  value: s,
                                  label: (statusLabels[s] || "").trim(),
                                }))
                                .filter((o) => Boolean(o.label))
                                .map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            variant="gold"
                            disabled={
                              selectedRowIds(rowSelection).length === 0 ||
                              !bulkStatus.trim() ||
                              bulkPending
                            }
                            isLoading={bulkPending}
                            pendingLabel={(chrome.update_status_pending || "").trim()}
                            onClick={() => void bulkCampaignStatus(bulkStatus)}
                          >
                            {(chrome.update_status_action || "").trim()}
                          </Button>
                        </>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={bulkPending}
                        onClick={() => setRowSelection({})}
                      >
                        {(chrome.clear_selection_action || "").trim()}
                      </Button>
                    </div>
                  ),
                }}
              />
            </>
          )}
        </section>
      ) : null}

      {detailLive && viewLabel && closeLabel ? (
        <Dialog open={detailDialog.open} onOpenChange={detailDialog.onOpenChange}>
          <DialogContent closeLabel={closeLabel} className="max-w-2xl sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{detailLive.title}</DialogTitle>
              <DialogDescription className="sr-only">{viewLabel}</DialogDescription>
            </DialogHeader>
            <CampaignDetailReadonly campaign={detailLive} chrome={chrome} />
            <DialogFooter>
              {editLabel ? (
                <Button
                  type="button"
                  variant="gold"
                  onClick={() => {
                    detailDialog.close();
                    openEdit(detailLive);
                  }}
                >
                  {editLabel}
                </Button>
              ) : null}
              {cancelLabel ? (
                <Button type="button" variant="outline" onClick={() => detailDialog.close()}>
                  {cancelLabel}
                </Button>
              ) : null}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {editLive && editLabel && closeLabel && campaignBounds ? (
        <Dialog open={editDialog.open} onOpenChange={editDialog.onOpenChange}>
          <DialogContent closeLabel={closeLabel} className="max-w-2xl sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editLive.title}</DialogTitle>
              <DialogDescription className="sr-only">{editLabel}</DialogDescription>
            </DialogHeader>
            <CampaignScheduleEditor
              campaign={editLive}
              chrome={campaignChrome ?? chrome}
              bounds={campaignBounds}
              statuses={campaignStatuses}
              statusLabels={statusLabels}
              token={token}
              enumsReady={Boolean(campaignStatuses.length)}
              compactHeader
            />
            <DialogFooter>
              {cancelLabel ? (
                <Button type="button" variant="outline" onClick={() => editDialog.close()}>
                  {cancelLabel}
                </Button>
              ) : null}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
