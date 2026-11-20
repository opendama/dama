"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useSaveCampaignScheduleMutation } from "@/hooks/mutation/useSaveCampaignScheduleMutation";
import { useAdPlaybackQuery } from "@/hooks/query/useAdPlaybackQuery";
import { sanitizeIntegerInput } from "@/lib/sanitize-integer-input";
import type { AdCampaign } from "@/types/ads";
import { useEffect, useState } from "react";

function optionalInt(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export function PublisherScheduleEditor({
  campaign,
  token,
}: {
  campaign: AdCampaign;
  token: string | null | undefined;
}) {
  const playback = useAdPlaybackQuery(Boolean(token));
  const save = useSaveCampaignScheduleMutation(token);
  const chrome = playback.data?.schedule_chrome;
  const bounds = playback.data;

  const [enabled, setEnabled] = useState(Boolean(campaign.schedule_enabled));
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

  useEffect(() => {
    setEnabled(Boolean(campaign.schedule_enabled));
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
  }, [campaign]);

  if (playback.isLoading) return null;
  if (!chrome || !bounds) {
    return (
      <p className="mt-3 text-xs text-[var(--dama-danger)]" role="alert" data-error="ad_playback" />
    );
  }

  return (
    <div className="mt-4 space-y-3 border-t border-[var(--dama-border)] pt-3">
      <label htmlFor="publisher-schedule-enabled" className="flex items-center gap-2 text-sm">
        <Checkbox
          id="publisher-schedule-enabled"
          checked={enabled}
          onCheckedChange={(v) => setEnabled(v === true)}
        />
        {chrome.schedule_enabled_label}
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-xs">
          {chrome.first_show_label}
          <input
            type="number"
            min={bounds.first_show_min}
            max={bounds.first_show_max}
            className="mt-1 w-full rounded-md border border-[var(--dama-border)] bg-[var(--dama-input)] px-2 py-1 text-sm"
            value={firstShow}
            onChange={(e) => setFirstShow(sanitizeIntegerInput(e.target.value))}
            inputMode="numeric"
            placeholder={chrome.platform_default_placeholder}
          />
        </label>
        <label className="block text-xs">
          {chrome.interval_label}
          <input
            type="number"
            min={bounds.interval_min}
            max={bounds.interval_max}
            className="mt-1 w-full rounded-md border border-[var(--dama-border)] bg-[var(--dama-input)] px-2 py-1 text-sm"
            value={interval}
            onChange={(e) => setIntervalSec(sanitizeIntegerInput(e.target.value))}
            inputMode="numeric"
            placeholder={chrome.platform_default_placeholder}
          />
        </label>
        <label className="block text-xs">
          {chrome.non_skippable_label}
          <input
            type="number"
            min={bounds.non_skippable_min}
            max={bounds.non_skippable_max}
            className="mt-1 w-full rounded-md border border-[var(--dama-border)] bg-[var(--dama-input)] px-2 py-1 text-sm"
            value={nonSkip}
            onChange={(e) => setNonSkip(sanitizeIntegerInput(e.target.value))}
            inputMode="numeric"
            placeholder={chrome.platform_default_placeholder}
          />
        </label>
        <label className="block text-xs">
          {chrome.daily_cap_label}
          <input
            type="number"
            min={bounds.impression_cap_min}
            className="mt-1 w-full rounded-md border border-[var(--dama-border)] bg-[var(--dama-input)] px-2 py-1 text-sm"
            value={daily}
            onChange={(e) => setDaily(sanitizeIntegerInput(e.target.value))}
            inputMode="numeric"
            placeholder={chrome.unlimited_cap_placeholder}
          />
        </label>
        <label className="block text-xs">
          {chrome.weekly_cap_label}
          <input
            type="number"
            min={bounds.impression_cap_min}
            className="mt-1 w-full rounded-md border border-[var(--dama-border)] bg-[var(--dama-input)] px-2 py-1 text-sm"
            value={weekly}
            onChange={(e) => setWeekly(sanitizeIntegerInput(e.target.value))}
            inputMode="numeric"
            placeholder={chrome.unlimited_cap_placeholder}
          />
        </label>
        <label className="block text-xs">
          {chrome.monthly_cap_label}
          <input
            type="number"
            min={bounds.impression_cap_min}
            className="mt-1 w-full rounded-md border border-[var(--dama-border)] bg-[var(--dama-input)] px-2 py-1 text-sm"
            value={monthly}
            onChange={(e) => setMonthly(sanitizeIntegerInput(e.target.value))}
            inputMode="numeric"
            placeholder={chrome.unlimited_cap_placeholder}
          />
        </label>
        <label className="block text-xs">
          {chrome.yearly_cap_label}
          <input
            type="number"
            min={bounds.impression_cap_min}
            className="mt-1 w-full rounded-md border border-[var(--dama-border)] bg-[var(--dama-input)] px-2 py-1 text-sm"
            value={yearly}
            onChange={(e) => setYearly(sanitizeIntegerInput(e.target.value))}
            inputMode="numeric"
            placeholder={chrome.unlimited_cap_placeholder}
          />
        </label>
      </div>
      <Button
        size="sm"
        isLoading={save.isPending}
        pendingLabel={chrome.save_campaign_schedule_pending}
        onClick={() =>
          save.mutate({
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
    </div>
  );
}
