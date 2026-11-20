"use client";

import { ArenaDurationField } from "@/components/tournaments/ArenaDurationField";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dualPursePlacePercentInvalid } from "@/lib/competition-payout";
import {
  useSaveCompetitionArenaSettingsMutation,
  useSaveCompetitionPayoutDefaultsMutation,
  useSaveCompetitionPrizeSettleSettingsMutation,
  useSaveCompetitionPointsToastSettingsMutation,
  useSaveCompetitionStandingsSettingsMutation,
} from "@/hooks/mutation";
import { useCompetitionPointsToastSettingsQuery } from "@/hooks/query";
import type { ClientEnums } from "@/types/platform";
import type { TournamentChrome } from "@/types/tournament-chrome";
import { useEffect, useState } from "react";

export function StandingsPointsCard({
  chrome,
  enums,
  token,
  disabled,
}: {
  chrome: Required<TournamentChrome>;
  enums: ClientEnums;
  token: string | null | undefined;
  disabled: boolean;
}) {
  const save = useSaveCompetitionStandingsSettingsMutation(token, chrome);
  const [pointsWin, setPointsWin] = useState("");
  const [pointsDraw, setPointsDraw] = useState("");
  useEffect(() => {
    setPointsWin((enums.competition_standings_points_win || "").trim());
    setPointsDraw((enums.competition_standings_points_draw || "").trim());
  }, [enums]);
  const saveDisabled = disabled || save.isPending || !pointsWin.trim() || !pointsDraw.trim();
  return (
    <section className="space-y-3 rounded-lg border border-[var(--dama-border)] p-4">
      <div>
        <h2 className="text-sm font-semibold">{chrome.standings_settings_title}</h2>
        <p className="mt-1 text-xs text-[var(--dama-muted)]">{chrome.standings_settings_blurb}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="standings-points-win" label={chrome.standings_settings_label_points_win}>
          <Input
            id="standings-points-win"
            inputMode="numeric"
            value={pointsWin}
            onChange={(e) => setPointsWin(e.target.value.replace(/\D/g, ""))}
            disabled={disabled || save.isPending}
          />
        </Field>
        <Field id="standings-points-draw" label={chrome.standings_settings_label_points_draw}>
          <Input
            id="standings-points-draw"
            inputMode="numeric"
            value={pointsDraw}
            onChange={(e) => setPointsDraw(e.target.value.replace(/\D/g, ""))}
            disabled={disabled || save.isPending}
          />
        </Field>
      </div>
      <Button
        variant="gold"
        disabled={saveDisabled}
        onClick={() =>
          save.mutate({
            competition_standings_points_win: pointsWin.trim(),
            competition_standings_points_draw: pointsDraw.trim(),
          })
        }
      >
        {save.isPending
          ? chrome.standings_settings_save_pending
          : chrome.standings_settings_save_action}
      </Button>
    </section>
  );
}

export function PointsToastSettingsCard({
  chrome,
  token,
  disabled,
}: {
  chrome: Required<TournamentChrome>;
  token: string | null | undefined;
  disabled: boolean;
}) {
  const q = useCompetitionPointsToastSettingsQuery(token, !disabled);
  const save = useSaveCompetitionPointsToastSettingsMutation(token, chrome);
  const [arenaLabel, setArenaLabel] = useState("");
  const [standingsLabel, setStandingsLabel] = useState("");
  const [toastFmt, setToastFmt] = useState("");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  useEffect(() => {
    const d = q.data;
    if (!d) return;
    setArenaLabel((d.arena_points_label || "").trim());
    setStandingsLabel((d.standings_points_label || "").trim());
    setToastFmt((d.toast_points_awarded_fmt || "").trim());
    setNotifTitle((d.notif_title_template || "").trim());
    setNotifBody((d.notif_body_template || "").trim());
  }, [q.data]);
  const saveDisabled =
    disabled ||
    save.isPending ||
    q.isLoading ||
    q.isError ||
    !arenaLabel.trim() ||
    !standingsLabel.trim() ||
    !toastFmt.trim() ||
    !notifTitle.trim() ||
    !notifBody.trim();
  return (
    <section className="space-y-3 rounded-lg border border-[var(--dama-border)] p-4">
      <div>
        <h2 className="text-sm font-semibold">{chrome.points_toast_settings_title}</h2>
        <p className="mt-1 text-xs text-[var(--dama-muted)]">
          {chrome.points_toast_settings_blurb}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          id="points-toast-arena-label"
          label={chrome.points_toast_settings_label_arena_points}
        >
          <Input
            id="points-toast-arena-label"
            value={arenaLabel}
            onChange={(e) => setArenaLabel(e.target.value)}
            disabled={disabled || save.isPending || q.isLoading}
          />
        </Field>
        <Field
          id="points-toast-standings-label"
          label={chrome.points_toast_settings_label_standings_points}
        >
          <Input
            id="points-toast-standings-label"
            value={standingsLabel}
            onChange={(e) => setStandingsLabel(e.target.value)}
            disabled={disabled || save.isPending || q.isLoading}
          />
        </Field>
        <Field id="points-toast-fmt" label={chrome.points_toast_settings_label_toast_fmt}>
          <Input
            id="points-toast-fmt"
            value={toastFmt}
            onChange={(e) => setToastFmt(e.target.value)}
            disabled={disabled || save.isPending || q.isLoading}
          />
        </Field>
        <Field id="points-toast-notif-title" label={chrome.points_toast_settings_label_notif_title}>
          <Input
            id="points-toast-notif-title"
            value={notifTitle}
            onChange={(e) => setNotifTitle(e.target.value)}
            disabled={disabled || save.isPending || q.isLoading}
          />
        </Field>
      </div>
      <Field id="points-toast-notif-body" label={chrome.points_toast_settings_label_notif_body}>
        <Input
          id="points-toast-notif-body"
          value={notifBody}
          onChange={(e) => setNotifBody(e.target.value)}
          disabled={disabled || save.isPending || q.isLoading}
        />
      </Field>
      <p className="text-xs text-[var(--dama-muted)]">
        {chrome.points_toast_settings_notif_body_blurb}
      </p>
      <Button
        variant="gold"
        disabled={saveDisabled}
        onClick={() =>
          save.mutate({
            arena_points_label: arenaLabel.trim(),
            standings_points_label: standingsLabel.trim(),
            toast_points_awarded_fmt: toastFmt.trim(),
            notif_title_template: notifTitle.trim(),
            notif_body_template: notifBody.trim(),
          })
        }
      >
        {save.isPending
          ? chrome.points_toast_settings_save_pending
          : chrome.points_toast_settings_save_action}
      </Button>
    </section>
  );
}

export function PayoutDefaultsCard({
  chrome,
  enums,
  token,
  disabled,
}: {
  chrome: Required<TournamentChrome>;
  enums: ClientEnums;
  token: string | null | undefined;
  disabled: boolean;
}) {
  const save = useSaveCompetitionPayoutDefaultsMutation(token, chrome);
  const modes = enums.competition_payout_modes ?? [];
  const [modeKo, setModeKo] = useState("");
  const [modeRr, setModeRr] = useState("");
  const [modeSwiss, setModeSwiss] = useState("");
  const [modeGk, setModeGk] = useState("");
  const [modeArena, setModeArena] = useState("");
  const [pct1, setPct1] = useState("");
  const [pct2, setPct2] = useState("");
  const [pct3, setPct3] = useState("");
  const [dualPlacePct, setDualPlacePct] = useState("");
  useEffect(() => {
    setModeKo((enums.competition_default_payout_mode_knockout || "").trim());
    setModeRr((enums.competition_default_payout_mode_round_robin || "").trim());
    setModeSwiss((enums.competition_default_payout_mode_swiss || "").trim());
    setModeGk((enums.competition_default_payout_mode_groups_knockout || "").trim());
    setModeArena((enums.competition_default_payout_mode_arena || "").trim());
    setPct1((enums.competition_default_place_percent_1 || "").trim());
    setPct2((enums.competition_default_place_percent_2 || "").trim());
    setPct3((enums.competition_default_place_percent_3 || "").trim());
    setDualPlacePct((enums.competition_dual_purse_place_percent || "").trim());
  }, [enums]);
  const koLabel = (chrome.payout_default_format_knockout_label || "").trim();
  const rrLabel = (chrome.payout_default_format_round_robin_label || "").trim();
  const swissLabel = (chrome.payout_default_format_swiss_label || "").trim();
  const gkLabel = (chrome.payout_default_format_groups_knockout_label || "").trim();
  const arenaLabel = (chrome.payout_default_format_arena_label || "").trim();
  const dualPlaceLabel = (chrome.dual_purse_place_percent_label || "").trim();
  const dualPlaceBlurb = (chrome.dual_purse_place_percent_blurb || "").trim();
  const dualPlacePctInvalid = Boolean(dualPlaceLabel) && dualPursePlacePercentInvalid(dualPlacePct);
  const saveDisabled =
    disabled ||
    save.isPending ||
    (koLabel ? !modeKo : false) ||
    (rrLabel ? !modeRr : false) ||
    (swissLabel ? !modeSwiss : false) ||
    (gkLabel ? !modeGk : false) ||
    (arenaLabel ? !modeArena : false) ||
    !pct1 ||
    !pct2 ||
    !pct3 ||
    (dualPlaceLabel ? !dualPlacePct : false) ||
    dualPlacePctInvalid;
  const placesMode = (enums.competition_payout_mode_places_percent || "").trim();
  const scoreMode = (enums.competition_payout_mode_score_share || "").trim();
  const dualMode = (enums.competition_payout_mode_dual_purse || "").trim();
  const placesModeLabel = (chrome.payout_mode_places_percent_label || "").trim();
  const scoreModeLabel = (chrome.payout_mode_score_share_label || "").trim();
  const dualModeLabel = (chrome.payout_mode_dual_purse_label || "").trim();
  const modeOptionLabel = (m: string) => {
    const v = (m || "").trim();
    if (v && v === placesMode) return placesModeLabel;
    if (v && v === scoreMode) return scoreModeLabel;
    if (v && v === dualMode) return dualModeLabel;
    return "";
  };
  const modeSelect = (id: string, value: string, onChange: (v: string) => void, label: string) => {
    if (!label) return null;
    const labeledModes = modes
      .map((m) => ({ value: m, label: modeOptionLabel(m) }))
      .filter((o) => o.label);
    if (labeledModes.length === 0) return null;
    return (
      <Field id={id} label={label}>
        <Select
          value={value || undefined}
          onValueChange={onChange}
          disabled={disabled || save.isPending}
        >
          <SelectTrigger id={id}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {labeledModes.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    );
  };
  return (
    <section className="space-y-3 rounded-lg border border-[var(--dama-border)] p-4">
      <div>
        <h2 className="text-sm font-semibold">{chrome.payout_settings_title}</h2>
        <p className="mt-1 text-xs text-[var(--dama-muted)]">{chrome.payout_settings_blurb}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modeSelect("payout-def-ko", modeKo, setModeKo, koLabel)}
        {modeSelect("payout-def-rr", modeRr, setModeRr, rrLabel)}
        {modeSelect("payout-def-swiss", modeSwiss, setModeSwiss, swissLabel)}
        {modeSelect("payout-def-gk", modeGk, setModeGk, gkLabel)}
        {modeSelect("payout-def-arena", modeArena, setModeArena, arenaLabel)}
        <Field id="payout-def-pct-1" label={chrome.prize_place_percent_1_label}>
          <Input
            id="payout-def-pct-1"
            value={pct1}
            onChange={(e) => setPct1(e.target.value)}
            placeholder={chrome.prize_place_percent_1_placeholder}
            disabled={disabled || save.isPending}
          />
        </Field>
        <Field id="payout-def-pct-2" label={chrome.prize_place_percent_2_label}>
          <Input
            id="payout-def-pct-2"
            value={pct2}
            onChange={(e) => setPct2(e.target.value)}
            placeholder={chrome.prize_place_percent_2_placeholder}
            disabled={disabled || save.isPending}
          />
        </Field>
        <Field id="payout-def-pct-3" label={chrome.prize_place_percent_3_label}>
          <Input
            id="payout-def-pct-3"
            value={pct3}
            onChange={(e) => setPct3(e.target.value)}
            placeholder={chrome.prize_place_percent_3_placeholder}
            disabled={disabled || save.isPending}
          />
        </Field>
        {dualPlaceLabel ? (
          <Field id="payout-def-dual-place" label={dualPlaceLabel} className="sm:col-span-2">
            <Input
              id="payout-def-dual-place"
              value={dualPlacePct}
              onChange={(e) => setDualPlacePct(e.target.value)}
              disabled={disabled || save.isPending}
              aria-invalid={dualPlacePctInvalid || undefined}
            />
            {dualPlaceBlurb ? (
              <p
                className={
                  dualPlacePctInvalid
                    ? "mt-1 text-xs text-red-600"
                    : "mt-1 text-xs text-[var(--dama-muted)]"
                }
              >
                {dualPlaceBlurb}
              </p>
            ) : null}
          </Field>
        ) : null}
      </div>
      <Button
        variant="gold"
        disabled={saveDisabled}
        onClick={() =>
          save.mutate({
            competition_default_payout_mode_knockout: modeKo.trim(),
            competition_default_payout_mode_round_robin: modeRr.trim(),
            competition_default_payout_mode_swiss: modeSwiss.trim(),
            competition_default_payout_mode_groups_knockout: modeGk.trim(),
            competition_default_payout_mode_arena: modeArena.trim(),
            competition_default_place_percent_1: pct1.trim(),
            competition_default_place_percent_2: pct2.trim(),
            competition_default_place_percent_3: pct3.trim(),
            competition_dual_purse_place_percent: dualPlacePct.trim(),
          })
        }
      >
        {save.isPending ? chrome.payout_settings_save_pending : chrome.payout_settings_save_action}
      </Button>
    </section>
  );
}

/** Dispute window + auto wallet credit for finished paid cups (tournaments + organizer events). */
export function PrizeSettleSettingsCard({
  chrome,
  enums,
  token,
  disabled,
}: {
  chrome: Required<TournamentChrome>;
  enums: ClientEnums;
  token: string | null | undefined;
  disabled: boolean;
}) {
  const save = useSaveCompetitionPrizeSettleSettingsMutation(token, chrome);
  const [autoSettle, setAutoSettle] = useState(false);
  const [disputeHours, setDisputeHours] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState("");
  useEffect(() => {
    const auto = (enums.competition_prize_auto_settle || "").trim().toLowerCase();
    setAutoSettle(auto === "true" || auto === "1" || auto === "yes" || auto === "on");
    setDisputeHours((enums.competition_dispute_window_hours || "").trim());
    setIntervalMinutes((enums.competition_prize_settle_interval_minutes || "").trim());
  }, [enums]);
  const saveDisabled =
    disabled ||
    save.isPending ||
    !disputeHours.trim() ||
    !intervalMinutes.trim() ||
    !(chrome.prize_settle_settings_save_action || "").trim();
  return (
    <section className="space-y-3 rounded-lg border border-[var(--dama-border)] p-4">
      <div>
        <h2 className="text-sm font-semibold">{chrome.prize_settle_settings_title}</h2>
        <p className="mt-1 text-xs text-[var(--dama-muted)]">
          {chrome.prize_settle_settings_blurb}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          id="prize-settle-auto"
          label={chrome.prize_settle_label_auto_settle}
          className="sm:col-span-2"
        >
          <div className="flex min-h-10 items-center gap-2 pt-1">
            <Checkbox
              id="prize-settle-auto"
              checked={autoSettle}
              disabled={disabled || save.isPending}
              onCheckedChange={(v) => setAutoSettle(v === true)}
            />
            <label htmlFor="prize-settle-auto" className="text-sm">
              {chrome.prize_settle_label_auto_settle}
            </label>
          </div>
          {(chrome.prize_settle_auto_settle_blurb || "").trim() ? (
            <p className="mt-1 text-xs text-[var(--dama-muted)]">
              {(chrome.prize_settle_auto_settle_blurb || "").trim()}
            </p>
          ) : null}
        </Field>
        <Field id="prize-settle-dispute-hours" label={chrome.prize_settle_label_dispute_hours}>
          <Input
            id="prize-settle-dispute-hours"
            inputMode="numeric"
            value={disputeHours}
            onChange={(e) => setDisputeHours(e.target.value.replace(/\D/g, ""))}
            disabled={disabled || save.isPending}
          />
        </Field>
        <Field id="prize-settle-interval" label={chrome.prize_settle_label_interval_minutes}>
          <Input
            id="prize-settle-interval"
            inputMode="numeric"
            value={intervalMinutes}
            onChange={(e) => setIntervalMinutes(e.target.value.replace(/\D/g, ""))}
            disabled={disabled || save.isPending}
          />
        </Field>
      </div>
      <Button
        variant="gold"
        disabled={saveDisabled}
        onClick={() =>
          save.mutate({
            competition_prize_auto_settle: autoSettle ? "true" : "false",
            competition_dispute_window_hours: disputeHours.trim(),
            competition_prize_settle_interval_minutes: intervalMinutes.trim(),
          })
        }
      >
        {save.isPending
          ? chrome.prize_settle_settings_save_pending
          : chrome.prize_settle_settings_save_action}
      </Button>
    </section>
  );
}

export function ArenaSettingsCard({
  chrome,
  enums,
  token,
  disabled,
}: {
  chrome: Required<TournamentChrome>;
  enums: ClientEnums;
  token: string | null | undefined;
  disabled: boolean;
}) {
  const save = useSaveCompetitionArenaSettingsMutation(token, chrome);
  const pairingModes = enums.competition_arena_pairing_modes ?? [];
  const [pointsWin, setPointsWin] = useState("");
  const [pointsDraw, setPointsDraw] = useState("");
  const [pointsLoss, setPointsLoss] = useState("");
  const [streakSecond, setStreakSecond] = useState("");
  const [streakThirdPlus, setStreakThirdPlus] = useState("");
  const [defaultDuration, setDefaultDuration] = useState("");
  const [pairingMode, setPairingMode] = useState("");
  const [autoStart, setAutoStart] = useState(false);
  const [pairInterval, setPairInterval] = useState("");
  const [allowJoinLive, setAllowJoinLive] = useState(false);

  useEffect(() => {
    setPointsWin((enums.competition_arena_points_win || "").trim());
    setPointsDraw((enums.competition_arena_points_draw || "").trim());
    setPointsLoss((enums.competition_arena_points_loss || "").trim());
    setStreakSecond((enums.competition_arena_streak_second_win || "").trim());
    setStreakThirdPlus((enums.competition_arena_streak_third_plus_win || "").trim());
    setDefaultDuration((enums.competition_arena_default_duration_minutes || "").trim());
    setPairingMode((enums.competition_arena_default_pairing_mode || "").trim());
    setAutoStart((enums.competition_arena_auto_start || "").trim().toLowerCase() === "true");
    setPairInterval((enums.competition_arena_pair_interval_seconds || "").trim());
    setAllowJoinLive(
      (enums.competition_arena_allow_join_while_live || "").trim().toLowerCase() === "true",
    );
  }, [enums]);

  const saveDisabled =
    disabled ||
    save.isPending ||
    !pointsWin.trim() ||
    !pointsDraw.trim() ||
    !pointsLoss.trim() ||
    !streakSecond.trim() ||
    !streakThirdPlus.trim() ||
    !defaultDuration.trim() ||
    !pairingMode.trim() ||
    !pairInterval.trim();

  return (
    <section className="space-y-3 rounded-lg border border-[var(--dama-border)] p-4">
      <div>
        <h2 className="text-sm font-semibold">{chrome.arena_settings_title}</h2>
        <p className="mt-1 text-xs text-[var(--dama-muted)]">{chrome.arena_settings_blurb}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field id="arena-points-win" label={chrome.arena_settings_label_points_win}>
          <Input
            id="arena-points-win"
            value={pointsWin}
            onChange={(e) => setPointsWin(e.target.value)}
            disabled={disabled || save.isPending}
          />
        </Field>
        <Field id="arena-points-draw" label={chrome.arena_settings_label_points_draw}>
          <Input
            id="arena-points-draw"
            value={pointsDraw}
            onChange={(e) => setPointsDraw(e.target.value)}
            disabled={disabled || save.isPending}
          />
        </Field>
        <Field id="arena-points-loss" label={chrome.arena_settings_label_points_loss}>
          <Input
            id="arena-points-loss"
            value={pointsLoss}
            onChange={(e) => setPointsLoss(e.target.value)}
            disabled={disabled || save.isPending}
          />
        </Field>
        <Field id="arena-streak-second" label={chrome.arena_settings_label_streak_second}>
          <Input
            id="arena-streak-second"
            value={streakSecond}
            onChange={(e) => setStreakSecond(e.target.value)}
            disabled={disabled || save.isPending}
          />
        </Field>
        <Field id="arena-streak-third" label={chrome.arena_settings_label_streak_third_plus}>
          <Input
            id="arena-streak-third"
            value={streakThirdPlus}
            onChange={(e) => setStreakThirdPlus(e.target.value)}
            disabled={disabled || save.isPending}
          />
        </Field>
        <div className="sm:col-span-2 lg:col-span-3">
          <ArenaDurationField
            idPrefix="arena-default"
            chrome={chrome}
            labelOverride={(chrome.arena_settings_label_default_duration || "").trim()}
            minutesValue={defaultDuration}
            onMinutesChange={setDefaultDuration}
            disabled={disabled || save.isPending}
          />
        </div>
        <Field id="arena-pairing-mode" label={chrome.arena_settings_label_pairing_mode}>
          <Select
            value={pairingMode}
            onValueChange={setPairingMode}
            disabled={disabled || save.isPending || pairingModes.length === 0}
          >
            <SelectTrigger id="arena-pairing-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pairingModes.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="arena-pair-interval" label={chrome.arena_settings_label_pair_interval}>
          <Input
            id="arena-pair-interval"
            inputMode="numeric"
            value={pairInterval}
            onChange={(e) => setPairInterval(e.target.value.replace(/\D/g, ""))}
            disabled={disabled || save.isPending}
          />
        </Field>
        <Field
          id="arena-auto-start"
          label={chrome.arena_settings_label_auto_start}
          className="sm:col-span-2"
        >
          <div className="flex min-h-10 items-center gap-2 pt-1">
            <Checkbox
              id="arena-auto-start"
              checked={autoStart}
              disabled={disabled || save.isPending}
              onCheckedChange={(v) => setAutoStart(v === true)}
            />
            <label htmlFor="arena-auto-start" className="text-sm">
              {chrome.arena_settings_label_auto_start}
            </label>
          </div>
        </Field>
        <Field
          id="arena-allow-join-live"
          label={chrome.arena_settings_label_allow_join_while_live}
          className="sm:col-span-2"
        >
          <div className="flex min-h-10 items-center gap-2 pt-1">
            <Checkbox
              id="arena-allow-join-live"
              checked={allowJoinLive}
              disabled={disabled || save.isPending}
              onCheckedChange={(v) => setAllowJoinLive(v === true)}
            />
            <label htmlFor="arena-allow-join-live" className="text-sm">
              {chrome.arena_settings_label_allow_join_while_live}
            </label>
          </div>
        </Field>
      </div>
      <div>
        <Button
          variant="gold"
          disabled={saveDisabled}
          onClick={() =>
            save.mutate({
              competition_arena_points_win: pointsWin.trim(),
              competition_arena_points_draw: pointsDraw.trim(),
              competition_arena_points_loss: pointsLoss.trim(),
              competition_arena_streak_second_win: streakSecond.trim(),
              competition_arena_streak_third_plus_win: streakThirdPlus.trim(),
              competition_arena_default_duration_minutes: defaultDuration.trim(),
              competition_arena_default_pairing_mode: pairingMode.trim(),
              competition_arena_auto_start: autoStart ? "true" : "false",
              competition_arena_pair_interval_seconds: pairInterval.trim(),
              competition_arena_allow_join_while_live: allowJoinLive ? "true" : "false",
            })
          }
        >
          {save.isPending ? chrome.arena_settings_save_pending : chrome.arena_settings_save_action}
        </Button>
      </div>
    </section>
  );
}
