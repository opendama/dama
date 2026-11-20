"use client";

import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { SignInLink } from "@/components/auth/SignInLink";
import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import { PauseDurationField } from "@/components/ui/pause-duration-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ProgressionBoardBodySkeleton,
  ProgressionBodySkeleton,
  ProgressionFormSkeleton,
  ProgressionPlatformBodySkeleton,
  ShimmerBlock,
} from "@/components/ui/shimmer-skeletons";
import { useSaveBoardRulesMutation, useSaveProgressionMutation } from "@/hooks/mutation";
import {
  useAdminConsoleChromeQuery,
  useConsoleGameRulesQuery,
  useConsoleProgressionQuery,
  usePaymentCurrencyQuery,
} from "@/hooks/query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDeferredDialogValue } from "@/hooks/use-deferred-dialog-selection";
import { useIsConsoleRole } from "@/hooks/useIsConsoleRole";
import { adminConsoleChromeUnavailable } from "@/lib/chrome-unavailable";
import { sanitizeIntegerInput } from "@/lib/sanitize-integer-input";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import type { XPLevel } from "@/types";
import { isAdminConsoleChromeReady } from "@/types/admin-console-chrome";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type XpFormMode =
  | { kind: "create" }
  | { kind: "edit"; index: number }
  | { kind: "view"; index: number };

type XpRow = XPLevel & { id: string };

type ProgressionTab = "platform" | "board";

function DetailRow({ label, value }: { label: string; value: string }) {
  const l = label.trim();
  if (!l) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--dama-muted)]">{l}</p>
      <p className="text-sm text-[var(--dama-text)]">{value}</p>
    </div>
  );
}

export default function ConsoleProgressionPage() {
  const token = useAuthStore((s) => s.token);
  const { isConsole: isAdmin, isLoading: roleLoading } = useIsConsoleRole();
  const chromeQuery = useAdminConsoleChromeQuery(true);
  const chrome = isAdminConsoleChromeReady(chromeQuery.data)
    ? chromeQuery.data.progression
    : undefined;

  const [levels, setLevels] = useState<XPLevel[]>([]);
  /** String drafts so admins can type "-" for loss rating without the field snapping. */
  const [winXp, setWinXp] = useState<string | null>(null);
  const [drawXp, setDrawXp] = useState<string | null>(null);
  const [lossXp, setLossXp] = useState<string | null>(null);
  const [winRating, setWinRating] = useState<string | null>(null);
  const [drawRating, setDrawRating] = useState<string | null>(null);
  const [lossRating, setLossRating] = useState<string | null>(null);
  const [startingRating, setStartingRating] = useState<string | null>(null);
  const [ratingFloor, setRatingFloor] = useState<string | null>(null);
  const [clockEnabled, setClockEnabled] = useState<boolean | null>(null);
  const [pauseEnabled, setPauseEnabled] = useState<boolean | null>(null);
  const [pauseDurationSeconds, setPauseDurationSeconds] = useState<number | null>(null);
  const [initialSeconds, setInitialSeconds] = useState<number | null>(null);
  const [incrementSeconds, setIncrementSeconds] = useState<number | null>(null);
  const [inviteTtlSeconds, setInviteTtlSeconds] = useState<number | null>(null);
  const [webAppOrigin, setWebAppOrigin] = useState("");
  const [unitCost, setUnitCost] = useState<number | null>(null);
  const [ethiopiaCreateFeeAmount, setEthiopiaCreateFeeAmount] = useState<number | null>(null);
  const [globalCreateFeeAmount, setGlobalCreateFeeAmount] = useState<number | null>(null);
  const [boardSize, setBoardSize] = useState<number | null>(null);
  const [piecesPerSide, setPiecesPerSide] = useState<number | null>(null);
  const [setupRows, setSetupRows] = useState<number | null>(null);
  const [boardVariant, setBoardVariant] = useState("");

  const [levelLabel, setLevelLabel] = useState("");
  const [levelMinXp, setLevelMinXp] = useState("");
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [xpSearch, setXpSearch] = useState("");
  const debouncedXpSearch = useDebouncedValue(xpSearch.trim().toLowerCase(), 250);
  const [rowSelection, setRowSelection] = useState<OpsRowSelectionState>({});

  const xpDialog = useDeferredDialogValue<XpFormMode>();
  const [tab, setTab] = useState<ProgressionTab>("platform");

  const { data, isLoading, error } = useConsoleProgressionQuery(token, isAdmin);
  const boardQuery = useConsoleGameRulesQuery(token, isAdmin);
  const currencyQuery = usePaymentCurrencyQuery();
  const save = useSaveProgressionMutation(token);
  const saveBoard = useSaveBoardRulesMutation(token);

  useEffect(() => {
    if (!data) return;
    setLevels(Array.isArray(data.xp_levels) ? data.xp_levels.map((l) => ({ ...l })) : []);
    const rewards = data.match_rewards;
    setWinXp(typeof rewards?.win_xp === "number" ? String(rewards.win_xp) : null);
    setDrawXp(typeof rewards?.draw_xp === "number" ? String(rewards.draw_xp) : null);
    setLossXp(typeof rewards?.loss_xp === "number" ? String(rewards.loss_xp) : null);
    setWinRating(typeof rewards?.win_rating === "number" ? String(rewards.win_rating) : null);
    setDrawRating(typeof rewards?.draw_rating === "number" ? String(rewards.draw_rating) : null);
    setLossRating(typeof rewards?.loss_rating === "number" ? String(rewards.loss_rating) : null);
    setStartingRating(
      typeof rewards?.starting_rating === "number" ? String(rewards.starting_rating) : null,
    );
    setRatingFloor(typeof rewards?.rating_floor === "number" ? String(rewards.rating_floor) : null);
    setClockEnabled(data.match_clock.enabled);
    setPauseEnabled(data.match_clock.pause_enabled === true);
    setPauseDurationSeconds(
      typeof data.match_clock.pause_duration_seconds === "number"
        ? data.match_clock.pause_duration_seconds
        : 0,
    );
    setInitialSeconds(data.match_clock.initial_seconds);
    setIncrementSeconds(data.match_clock.increment_seconds);
    setInviteTtlSeconds(data.match_clock.invite_ttl_seconds);
    setWebAppOrigin((data.web_app_origin || "").trim());
    setUnitCost(data.ad_pricing.impression_unit_cost);
    setEthiopiaCreateFeeAmount(data.ad_pricing.campaign_create_fee_ethiopia_amount);
    setGlobalCreateFeeAmount(data.ad_pricing.campaign_create_fee_global_amount);
  }, [data]);

  useEffect(() => {
    if (!boardQuery.data) return;
    setBoardSize(boardQuery.data.size);
    setPiecesPerSide(boardQuery.data.pieces_per_side);
    setSetupRows(boardQuery.data.setup_rows);
    setBoardVariant(boardQuery.data.variant);
  }, [boardQuery.data]);

  useEffect(() => {
    if (!xpDialog.open || !xpDialog.value) return;
    const mode = xpDialog.value;
    if (mode.kind === "create") {
      setLevelLabel("");
      setLevelMinXp("");
      return;
    }
    const row = levels[mode.index];
    if (!row) return;
    setLevelLabel(row.label || "");
    setLevelMinXp(String(row.min_xp ?? ""));
  }, [xpDialog.open, xpDialog.value, levels]);

  const progressionLoading = isAdmin && isLoading;
  const boardLoading = isAdmin && boardQuery.isLoading;

  const xpRows: XpRow[] = useMemo(
    () =>
      levels.map((l, i) => ({
        ...l,
        id: `xp-${i}-${l.label}-${l.min_xp}`,
      })),
    [levels],
  );
  const filteredXpRows = useMemo(() => {
    if (!debouncedXpSearch) return xpRows;
    return xpRows.filter((r) => r.label.toLowerCase().includes(debouncedXpSearch));
  }, [debouncedXpSearch, xpRows]);

  const xpColumns = useMemo((): OpsColumn<XpRow>[] => {
    if (!chrome) return [];
    const labelHeader = (chrome.xp_col_label || "").trim();
    const minHeader = (chrome.xp_col_min_xp || "").trim();
    const actionsHeader = (chrome.xp_actions_label || "").trim();
    const viewLabel = (chrome.xp_view_action || "").trim();
    const editLabel = (chrome.xp_edit_action || "").trim();
    const deleteLabel = (chrome.xp_delete_action || "").trim();
    const cols: OpsColumn<XpRow>[] = [
      {
        id: "label",
        header: labelHeader,
        cell: (row: XpRow) => <span className="font-medium">{row.label}</span>,
      },
      {
        id: "min_xp",
        header: minHeader,
        cell: (row: XpRow) => <span className="font-mono tabular-nums">{row.min_xp}</span>,
      },
      {
        id: "actions",
        header: actionsHeader,
        className: "w-12 text-right",
        cell: (row: XpRow) => {
          const index = xpRows.findIndex((r) => r.id === row.id);
          if (index < 0) return null;
          return (
            <OpsDataTableRowActions
              triggerLabel={actionsHeader}
              actions={[
                {
                  id: "view",
                  label: viewLabel,
                  onSelect: () => xpDialog.openWith({ kind: "view", index }),
                },
                {
                  id: "edit",
                  label: editLabel,
                  onSelect: () => xpDialog.openWith({ kind: "edit", index }),
                },
                {
                  id: "delete",
                  label: deleteLabel,
                  destructive: true,
                  onSelect: () => setDeleteIndex(index),
                },
              ]}
            />
          );
        },
      },
    ];
    return cols.filter((c) => c.id === "actions" || Boolean(c.header));
  }, [chrome, xpDialog, xpRows]);

  function saveXpLevel() {
    const mode = xpDialog.value;
    if (!mode || mode.kind === "view") return;
    const label = levelLabel.trim();
    const minRaw = levelMinXp.trim();
    const minXp = Number.parseInt(minRaw, 10);
    if (!label || !Number.isFinite(minXp) || minXp < 0) return;
    const next = { label, min_xp: minXp };
    setLevels((prev) => {
      if (mode.kind === "create") return [...prev, next];
      return prev.map((row, i) => (i === mode.index ? next : row));
    });
    xpDialog.close();
  }

  if (chromeQuery.isLoading) {
    return (
      <div className="space-y-6">
        <ProgressionFormSkeleton tab={tab} />
      </div>
    );
  }

  if (!chrome) {
    const unavailable = adminConsoleChromeUnavailable(chromeQuery.data, chromeQuery.error);
    return <div className="p-6 text-sm text-[var(--dama-muted)]">{unavailable}</div>;
  }

  const ethiopiaCur = (currencyQuery.data?.ethiopia || "").trim().toUpperCase();
  const globalCur = (currencyQuery.data?.global || "").trim().toUpperCase();
  const emptyChrome = (chrome.empty_value || "").trim();
  const geoBlurb = (chrome.campaign_create_fee_geo_blurb || "")
    .replaceAll("{ethiopia}", ethiopiaCur || emptyChrome)
    .replaceAll("{global}", globalCur || emptyChrome);

  const xpMode = xpDialog.value;
  const xpFormTitle =
    xpMode?.kind === "edit"
      ? chrome.xp_edit_modal_title
      : xpMode?.kind === "view"
        ? chrome.xp_detail_modal_title
        : chrome.xp_create_modal_title;
  const xpViewing = xpMode?.kind === "view";

  const tabPlatform = (chrome.page_title || "").trim() || (chrome.xp_levels_label || "").trim();
  const tabBoard = (chrome.board_section_title || "").trim();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{chrome.page_title}</h1>
        <p className="mt-1 text-sm text-[var(--dama-muted)]">{chrome.page_blurb}</p>
      </div>

      {roleLoading ? (
        <ProgressionBodySkeleton tab={tab} />
      ) : !isAdmin ? (
        <p className="rounded-md border border-[var(--dama-border)] p-4 text-sm">
          <SignInLink className="text-[var(--dama-gold)] underline" />
        </p>
      ) : (
        <>
          <div
            role="tablist"
            aria-label={(chrome.page_title || "").trim() || undefined}
            className="flex max-w-full flex-wrap gap-1 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-surface)] p-1"
          >
            {(
              [
                { id: "platform" as const, label: tabPlatform },
                { id: "board" as const, label: tabBoard },
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

          {tab === "platform" ? (
            <div className="space-y-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
              {progressionLoading ? (
                <ProgressionPlatformBodySkeleton />
              ) : error ? (
                <p className="text-sm text-[var(--dama-danger)]">{chrome.load_failed}</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-[var(--dama-text)]">
                      {chrome.xp_levels_label}
                    </h2>
                    <Button
                      type="button"
                      size="sm"
                      variant="gold"
                      disabled={save.isPending}
                      onClick={() => xpDialog.openWith({ kind: "create" })}
                    >
                      {chrome.xp_add_action}
                    </Button>
                  </div>
                  <AdminFilterBar
                    filters={[
                      {
                        kind: "search",
                        id: "admin-xp-search",
                        label: (chrome.xp_search_label || "").trim(),
                        value: xpSearch,
                        onChange: setXpSearch,
                        placeholder: (chrome.xp_search_placeholder || "").trim() || undefined,
                      },
                    ]}
                  />
                  <OpsDataTable
                    columns={xpColumns}
                    data={filteredXpRows}
                    getRowId={(row) => row.id}
                    empty={
                      <p className="py-6 text-center text-sm text-[var(--dama-muted)]">
                        {chrome.xp_empty}
                      </p>
                    }
                    selection={{
                      chrome: {
                        selectAllLabel: (chrome.select_all_label || "").trim(),
                        selectRowLabel: (chrome.select_row_label || "").trim(),
                        selectedCountFmt: (chrome.selected_count_fmt || "").trim(),
                      },
                      rowSelection,
                      onRowSelectionChange: setRowSelection,
                      toolbar: (
                        <div className="flex flex-wrap gap-2">
                          {(chrome.xp_delete_action || "").trim() ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={selectedRowIds(rowSelection).length === 0}
                              onClick={() => setBulkDeleteOpen(true)}
                            >
                              {(chrome.xp_delete_action || "").trim()}
                            </Button>
                          ) : null}
                          <Button size="sm" variant="outline" onClick={() => setRowSelection({})}>
                            {(chrome.clear_selection_action || "").trim()}
                          </Button>
                        </div>
                      ),
                    }}
                  />

                  <div className="space-y-3 border-t border-[var(--dama-border)] pt-4">
                    <div>
                      <h2 className="text-sm font-semibold text-[var(--dama-text)]">
                        {chrome.match_rewards_section_title}
                      </h2>
                      <p className="mt-1 text-sm text-[var(--dama-muted)]">
                        {chrome.match_rewards_blurb}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field id="progression-win-xp" label={chrome.win_xp_label}>
                        {winXp == null ? (
                          <ShimmerBlock className="h-10 w-full rounded-md" />
                        ) : (
                          <Input
                            id="progression-win-xp"
                            inputMode="numeric"
                            value={winXp}
                            onChange={(e) => setWinXp(sanitizeIntegerInput(e.target.value))}
                            disabled={!isAdmin || save.isPending}
                          />
                        )}
                      </Field>
                      <Field id="progression-draw-xp" label={chrome.draw_xp_label}>
                        {drawXp == null ? (
                          <ShimmerBlock className="h-10 w-full rounded-md" />
                        ) : (
                          <Input
                            id="progression-draw-xp"
                            inputMode="numeric"
                            value={drawXp}
                            onChange={(e) => setDrawXp(sanitizeIntegerInput(e.target.value))}
                            disabled={!isAdmin || save.isPending}
                          />
                        )}
                      </Field>
                      <Field id="progression-loss-xp" label={chrome.loss_xp_label}>
                        {lossXp == null ? (
                          <ShimmerBlock className="h-10 w-full rounded-md" />
                        ) : (
                          <Input
                            id="progression-loss-xp"
                            inputMode="numeric"
                            value={lossXp}
                            onChange={(e) => setLossXp(sanitizeIntegerInput(e.target.value))}
                            disabled={!isAdmin || save.isPending}
                          />
                        )}
                      </Field>
                      <Field id="progression-win-rating" label={chrome.win_rating_label}>
                        {winRating == null ? (
                          <ShimmerBlock className="h-10 w-full rounded-md" />
                        ) : (
                          <Input
                            id="progression-win-rating"
                            inputMode="numeric"
                            value={winRating}
                            onChange={(e) =>
                              setWinRating(
                                sanitizeIntegerInput(e.target.value, { allowNegative: true }),
                              )
                            }
                            disabled={!isAdmin || save.isPending}
                          />
                        )}
                      </Field>
                      <Field id="progression-draw-rating" label={chrome.draw_rating_label}>
                        {drawRating == null ? (
                          <ShimmerBlock className="h-10 w-full rounded-md" />
                        ) : (
                          <Input
                            id="progression-draw-rating"
                            inputMode="numeric"
                            value={drawRating}
                            onChange={(e) =>
                              setDrawRating(
                                sanitizeIntegerInput(e.target.value, { allowNegative: true }),
                              )
                            }
                            disabled={!isAdmin || save.isPending}
                          />
                        )}
                      </Field>
                      <Field id="progression-loss-rating" label={chrome.loss_rating_label}>
                        {lossRating == null ? (
                          <ShimmerBlock className="h-10 w-full rounded-md" />
                        ) : (
                          <Input
                            id="progression-loss-rating"
                            inputMode="numeric"
                            value={lossRating}
                            onChange={(e) =>
                              setLossRating(
                                sanitizeIntegerInput(e.target.value, { allowNegative: true }),
                              )
                            }
                            disabled={!isAdmin || save.isPending}
                          />
                        )}
                      </Field>
                      <Field id="progression-rating-floor" label={chrome.rating_floor_label}>
                        {ratingFloor == null ? (
                          <ShimmerBlock className="h-10 w-full rounded-md" />
                        ) : (
                          <Input
                            id="progression-rating-floor"
                            inputMode="numeric"
                            value={ratingFloor}
                            onChange={(e) => setRatingFloor(sanitizeIntegerInput(e.target.value))}
                            disabled={!isAdmin || save.isPending}
                          />
                        )}
                      </Field>
                      <Field id="progression-starting-rating" label={chrome.starting_rating_label}>
                        {startingRating == null ? (
                          <ShimmerBlock className="h-10 w-full rounded-md" />
                        ) : (
                          <Input
                            id="progression-starting-rating"
                            inputMode="numeric"
                            value={startingRating}
                            onChange={(e) =>
                              setStartingRating(sanitizeIntegerInput(e.target.value))
                            }
                            disabled={!isAdmin || save.isPending}
                          />
                        )}
                      </Field>
                    </div>
                  </div>

                  <Field id="progression-clock-enabled" label={chrome.match_clock_enabled_label}>
                    <div className="flex min-h-10 items-center gap-2 pt-1">
                      <Checkbox
                        id="progression-clock-enabled"
                        checked={clockEnabled ?? false}
                        onCheckedChange={(v) => setClockEnabled(v === true)}
                        disabled={!isAdmin || save.isPending || clockEnabled == null}
                      />
                    </div>
                  </Field>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field id="progression-pause-enabled" label={chrome.pause_enabled_label}>
                      <div className="flex min-h-10 items-center gap-2 pt-1">
                        <Checkbox
                          id="progression-pause-enabled"
                          checked={pauseEnabled ?? false}
                          onCheckedChange={(v) => setPauseEnabled(v === true)}
                          disabled={!isAdmin || save.isPending || pauseEnabled == null}
                        />
                      </div>
                    </Field>
                    {pauseDurationSeconds == null ? (
                      <ShimmerBlock className="h-10 w-full rounded-md" />
                    ) : (
                      <Field
                        id="progression-pause-duration"
                        label={chrome.pause_duration_label}
                        description={chrome.pause_duration_blurb}
                        descriptionWrap
                      >
                        <PauseDurationField
                          id="progression-pause-duration"
                          valueSeconds={pauseDurationSeconds}
                          onChange={setPauseDurationSeconds}
                          disabled={!isAdmin || save.isPending}
                          placeholder={(chrome.pause_duration_placeholder || "").trim()}
                          unitAria={(chrome.pause_duration_unit_aria || "").trim()}
                          secondsLabel={(chrome.pause_duration_seconds_label || "").trim()}
                          minutesLabel={(chrome.pause_duration_minutes_label || "").trim()}
                        />
                      </Field>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field
                      id="progression-initial"
                      label={chrome.initial_seconds_label}
                      description={chrome.initial_seconds_blurb}
                      descriptionWrap
                    >
                      {(data?.match_clock.presets?.length ?? 0) > 0 ? (
                        <Select
                          value={
                            initialSeconds != null && initialSeconds > 0
                              ? String(initialSeconds)
                              : undefined
                          }
                          onValueChange={(next) => {
                            const n = Number(next);
                            setInitialSeconds(Number.isFinite(n) && n > 0 ? n : null);
                          }}
                          disabled={!isAdmin || save.isPending || initialSeconds == null}
                        >
                          <SelectTrigger id="progression-initial">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(data?.match_clock.presets ?? []).map((p) => (
                              <SelectItem key={`${p.seconds}-${p.label}`} value={String(p.seconds)}>
                                {p.label} ({p.seconds}s)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id="progression-initial"
                          type="number"
                          min={1}
                          value={initialSeconds ?? ""}
                          onChange={(e) => {
                            const digits = sanitizeIntegerInput(e.target.value);
                            setInitialSeconds(digits === "" ? null : Number(digits));
                          }}
                          inputMode="numeric"
                          disabled={!isAdmin || save.isPending || initialSeconds == null}
                        />
                      )}
                    </Field>
                    <Field id="progression-increment" label={chrome.increment_seconds_label}>
                      <Input
                        id="progression-increment"
                        type="number"
                        min={0}
                        value={incrementSeconds ?? ""}
                        onChange={(e) => {
                          const digits = sanitizeIntegerInput(e.target.value);
                          setIncrementSeconds(digits === "" ? null : Number(digits));
                        }}
                        inputMode="numeric"
                        disabled={!isAdmin || save.isPending || incrementSeconds == null}
                      />
                    </Field>
                    <Field id="progression-invite-ttl" label={chrome.invite_ttl_seconds_label}>
                      <Input
                        id="progression-invite-ttl"
                        type="number"
                        min={1}
                        value={inviteTtlSeconds ?? ""}
                        onChange={(e) => {
                          const digits = sanitizeIntegerInput(e.target.value);
                          setInviteTtlSeconds(digits === "" ? null : Number(digits));
                        }}
                        inputMode="numeric"
                        disabled={!isAdmin || save.isPending || inviteTtlSeconds == null}
                      />
                    </Field>
                    <Field id="progression-unit-cost" label={chrome.unit_cost_label}>
                      <AmountInput
                        id="progression-unit-cost"
                        value={unitCost == null ? "" : String(unitCost)}
                        onValueChange={(next) => {
                          setUnitCost(next === "" ? null : Number(next));
                        }}
                        disabled={!isAdmin || save.isPending || unitCost == null}
                        maxDecimals={4}
                      />
                    </Field>
                  </div>

                  {(data?.match_clock.presets?.length ?? 0) > 0 ? (
                    <Field
                      id="progression-clock-presets"
                      label={chrome.match_clock_presets_label}
                      description={chrome.match_clock_presets_blurb}
                      descriptionWrap
                    >
                      <ul className="space-y-1 text-sm text-[var(--dama-text)]">
                        {(data?.match_clock.presets ?? []).map((p) => (
                          <li key={`${p.seconds}-${p.label}`}>
                            {p.label}
                            <span className="text-[var(--dama-muted)]"> ({p.seconds}s)</span>
                          </li>
                        ))}
                      </ul>
                    </Field>
                  ) : null}

                  <div className="space-y-3 border-t border-[var(--dama-border)] pt-4">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--dama-text)]">
                        {chrome.campaign_create_fees_section_title}
                      </h3>
                      {currencyQuery.isLoading ? (
                        <ShimmerBlock className="mt-1 h-4 w-full max-w-xl rounded-md" />
                      ) : (
                        <p className="mt-1 text-sm text-[var(--dama-muted)]">{geoBlurb}</p>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field
                        id="progression-create-fee-ethiopia"
                        label={chrome.campaign_create_fee_ethiopia_label}
                      >
                        <AmountInput
                          id="progression-create-fee-ethiopia"
                          value={
                            ethiopiaCreateFeeAmount == null ? "" : String(ethiopiaCreateFeeAmount)
                          }
                          onValueChange={(next) => {
                            setEthiopiaCreateFeeAmount(next === "" ? null : Number(next));
                          }}
                          disabled={!isAdmin || save.isPending || ethiopiaCreateFeeAmount == null}
                          maxDecimals={2}
                        />
                      </Field>
                      <Field
                        id="progression-create-fee-ethiopia-currency"
                        label={chrome.campaign_create_fee_ethiopia_currency_label}
                      >
                        {currencyQuery.isLoading ? (
                          <ShimmerBlock className="h-10 w-full rounded-md" />
                        ) : (
                          <p className="rounded-md border border-[var(--dama-border)] bg-[var(--dama-surface)] px-3 py-2 text-sm text-[var(--dama-muted)]">
                            {ethiopiaCur || emptyChrome}
                          </p>
                        )}
                      </Field>
                      <Field
                        id="progression-create-fee-global"
                        label={chrome.campaign_create_fee_global_label}
                      >
                        <AmountInput
                          id="progression-create-fee-global"
                          value={globalCreateFeeAmount == null ? "" : String(globalCreateFeeAmount)}
                          onValueChange={(next) => {
                            setGlobalCreateFeeAmount(next === "" ? null : Number(next));
                          }}
                          disabled={!isAdmin || save.isPending || globalCreateFeeAmount == null}
                          maxDecimals={2}
                        />
                      </Field>
                      <Field
                        id="progression-create-fee-global-currency"
                        label={chrome.campaign_create_fee_global_currency_label}
                      >
                        {currencyQuery.isLoading ? (
                          <ShimmerBlock className="h-10 w-full rounded-md" />
                        ) : (
                          <p className="rounded-md border border-[var(--dama-border)] bg-[var(--dama-surface)] px-3 py-2 text-sm text-[var(--dama-muted)]">
                            {globalCur || emptyChrome}
                          </p>
                        )}
                      </Field>
                    </div>
                  </div>

                  <Field id="progression-web-origin" label={chrome.web_app_origin_label}>
                    <Input
                      id="progression-web-origin"
                      type="url"
                      value={webAppOrigin}
                      onChange={(e) => setWebAppOrigin(e.target.value.trim())}
                      disabled={!isAdmin || save.isPending}
                      autoComplete="url"
                    />
                  </Field>

                  <Button
                    variant="gold"
                    isLoading={save.isPending}
                    pendingLabel={chrome.save_platform_pending}
                    disabled={
                      !isAdmin ||
                      unitCost == null ||
                      ethiopiaCreateFeeAmount == null ||
                      globalCreateFeeAmount == null ||
                      winXp == null ||
                      drawXp == null ||
                      lossXp == null ||
                      winRating == null ||
                      drawRating == null ||
                      lossRating == null ||
                      ratingFloor == null ||
                      startingRating == null
                    }
                    onClick={() => {
                      try {
                        if (!levels.length) {
                          throw new Error((chrome.err_xp_levels_empty || "").trim());
                        }
                        const parseRewardInt = (raw: string | null, allowNegative: boolean) => {
                          if (raw == null) return null;
                          const cleaned = sanitizeIntegerInput(raw, { allowNegative });
                          if (cleaned === "" || cleaned === "-") return null;
                          const n = Number(cleaned);
                          if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
                          return n;
                        };
                        const winXpN = parseRewardInt(winXp, false);
                        const drawXpN = parseRewardInt(drawXp, false);
                        const lossXpN = parseRewardInt(lossXp, false);
                        if (
                          winXpN == null ||
                          drawXpN == null ||
                          lossXpN == null ||
                          winXpN < 0 ||
                          drawXpN < 0 ||
                          lossXpN < 0
                        ) {
                          throw new Error((chrome.err_match_rewards_xp || "").trim());
                        }
                        const winRatingN = parseRewardInt(winRating, true);
                        const drawRatingN = parseRewardInt(drawRating, true);
                        const lossRatingN = parseRewardInt(lossRating, true);
                        if (winRatingN == null || drawRatingN == null || lossRatingN == null) {
                          throw new Error((chrome.err_match_rewards_rating || "").trim());
                        }
                        const ratingFloorN = parseRewardInt(ratingFloor, false);
                        if (ratingFloorN == null || ratingFloorN < 0) {
                          throw new Error((chrome.err_rating_floor || "").trim());
                        }
                        const startingRatingN = parseRewardInt(startingRating, false);
                        if (startingRatingN == null || startingRatingN < ratingFloorN) {
                          throw new Error((chrome.err_starting_rating || "").trim());
                        }
                        if (unitCost == null || !(unitCost > 0)) {
                          throw new Error(chrome.err_unit_cost);
                        }
                        if (
                          ethiopiaCreateFeeAmount == null ||
                          !(ethiopiaCreateFeeAmount > 0) ||
                          !ethiopiaCur ||
                          globalCreateFeeAmount == null ||
                          !(globalCreateFeeAmount > 0) ||
                          !globalCur
                        ) {
                          throw new Error(chrome.err_campaign_create_fee);
                        }
                        if (
                          clockEnabled == null ||
                          initialSeconds == null ||
                          incrementSeconds == null ||
                          inviteTtlSeconds == null ||
                          !(inviteTtlSeconds > 0)
                        ) {
                          throw new Error(chrome.err_clock_values);
                        }
                        if (pauseEnabled == null || pauseDurationSeconds == null) {
                          throw new Error((chrome.err_pause_duration || "").trim());
                        }
                        if (pauseEnabled && !(pauseDurationSeconds > 0)) {
                          throw new Error((chrome.err_pause_duration || "").trim());
                        }
                        const presetSecs = (data?.match_clock.presets ?? []).map((p) => p.seconds);
                        if (presetSecs.length > 0 && !presetSecs.includes(initialSeconds)) {
                          throw new Error(
                            (chrome.err_clock_initial_not_in_presets || "").trim() ||
                              chrome.err_clock_values,
                          );
                        }
                        const origin = (webAppOrigin || "").trim().replace(/\/$/, "");
                        if (!origin || !/^https?:\/\//i.test(origin)) {
                          throw new Error(chrome.err_web_app_origin);
                        }
                        save.mutate({
                          xp_levels: levels,
                          match_rewards: {
                            win_xp: winXpN,
                            draw_xp: drawXpN,
                            loss_xp: lossXpN,
                            win_rating: winRatingN,
                            draw_rating: drawRatingN,
                            loss_rating: lossRatingN,
                            rating_floor: ratingFloorN,
                            starting_rating: startingRatingN,
                          },
                          match_clock: {
                            enabled: clockEnabled,
                            initial_seconds: initialSeconds,
                            increment_seconds: incrementSeconds,
                            invite_ttl_seconds: inviteTtlSeconds,
                            pause_enabled: pauseEnabled,
                            pause_duration_seconds: pauseDurationSeconds,
                          },
                          ad_pricing: {
                            impression_unit_cost: unitCost,
                            campaign_create_fee_ethiopia_amount: ethiopiaCreateFeeAmount,
                            campaign_create_fee_ethiopia_currency: ethiopiaCur,
                            campaign_create_fee_global_amount: globalCreateFeeAmount,
                            campaign_create_fee_global_currency: globalCur,
                          },
                          web_app_origin: origin,
                        });
                      } catch (err) {
                        const msg =
                          (err instanceof Error ? err.message : "").trim() ||
                          (chrome.toast_save_failed || "").trim();
                        if (msg) toast.error(msg);
                      }
                    }}
                  >
                    {chrome.save_platform_action}
                  </Button>
                </>
              )}
            </div>
          ) : null}

          {tab === "board" ? (
            <div className="space-y-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
              <h2 className="font-semibold text-[var(--dama-gold)]">
                {chrome.board_section_title}
              </h2>
              {boardLoading ? (
                <ProgressionBoardBodySkeleton />
              ) : boardQuery.error || boardSize == null ? (
                <p className="text-sm text-[var(--dama-danger)]">{chrome.board_unavailable}</p>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field id="board-size" label={chrome.board_size_label}>
                      <Input
                        id="board-size"
                        type="number"
                        min={1}
                        value={boardSize}
                        onChange={(e) => {
                          const digits = sanitizeIntegerInput(e.target.value);
                          setBoardSize(digits === "" ? 0 : Number(digits));
                        }}
                        inputMode="numeric"
                        disabled={!isAdmin || saveBoard.isPending}
                      />
                    </Field>
                    <Field id="board-pieces" label={chrome.pieces_per_side_label}>
                      <Input
                        id="board-pieces"
                        type="number"
                        min={1}
                        value={piecesPerSide ?? ""}
                        onChange={(e) => {
                          const digits = sanitizeIntegerInput(e.target.value);
                          setPiecesPerSide(digits === "" ? null : Number(digits));
                        }}
                        inputMode="numeric"
                        disabled={!isAdmin || saveBoard.isPending}
                      />
                    </Field>
                    <Field id="board-setup" label={chrome.setup_rows_label}>
                      <Input
                        id="board-setup"
                        type="number"
                        min={1}
                        value={setupRows ?? ""}
                        onChange={(e) => {
                          const digits = sanitizeIntegerInput(e.target.value);
                          setSetupRows(digits === "" ? null : Number(digits));
                        }}
                        inputMode="numeric"
                        disabled={!isAdmin || saveBoard.isPending}
                      />
                    </Field>
                    <Field id="board-variant" label={chrome.variant_label}>
                      <Input
                        id="board-variant"
                        value={boardVariant}
                        onChange={(e) => setBoardVariant(e.target.value)}
                        disabled={!isAdmin || saveBoard.isPending}
                      />
                    </Field>
                  </div>
                  <Button
                    variant="gold"
                    isLoading={saveBoard.isPending}
                    pendingLabel={chrome.save_board_pending}
                    disabled={!isAdmin}
                    onClick={() => {
                      if (
                        boardSize == null ||
                        piecesPerSide == null ||
                        setupRows == null ||
                        !boardVariant.trim()
                      ) {
                        const msg = (chrome.board_fields_required || "").trim();
                        if (msg) toast.error(msg);
                        return;
                      }
                      saveBoard.mutate({
                        size: boardSize,
                        pieces_per_side: piecesPerSide,
                        setup_rows: setupRows,
                        variant: boardVariant.trim(),
                      });
                    }}
                  >
                    {chrome.save_board_action}
                  </Button>
                </>
              )}
            </div>
          ) : null}
        </>
      )}

      <Dialog open={xpDialog.open} onOpenChange={xpDialog.onOpenChange}>
        <DialogContent
          closeLabel={(chrome.xp_dialog_close_label || "").trim()}
          className="max-w-lg sm:max-w-xl"
        >
          <DialogHeader>
            <DialogTitle>{xpFormTitle}</DialogTitle>
            <DialogDescription className="sr-only">{xpFormTitle}</DialogDescription>
          </DialogHeader>
          {xpViewing ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailRow
                label={(chrome.xp_label_field || "").trim()}
                value={levelLabel || (chrome.empty_value || "").trim()}
              />
              <DetailRow
                label={(chrome.xp_min_xp_field || "").trim()}
                value={levelMinXp || (chrome.empty_value || "").trim()}
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="xp-level-label" label={(chrome.xp_label_field || "").trim()}>
                <Input
                  id="xp-level-label"
                  value={levelLabel}
                  onChange={(e) => setLevelLabel(e.target.value)}
                />
              </Field>
              <Field id="xp-level-min" label={(chrome.xp_min_xp_field || "").trim()}>
                <Input
                  id="xp-level-min"
                  inputMode="numeric"
                  value={levelMinXp}
                  onChange={(e) => setLevelMinXp(sanitizeIntegerInput(e.target.value))}
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => xpDialog.close()}>
              {xpViewing
                ? (chrome.xp_dialog_close_label || "").trim()
                : (chrome.xp_cancel_action || "").trim()}
            </Button>
            {!xpViewing ? (
              <Button
                type="button"
                variant="gold"
                pendingLabel={(chrome.xp_save_pending || "").trim()}
                disabled={!levelLabel.trim() || levelMinXp.trim() === ""}
                onClick={() => saveXpLevel()}
              >
                {(chrome.xp_save_action || "").trim()}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteIndex != null}
        onOpenChange={(open) => {
          if (!open) setDeleteIndex(null);
        }}
        title={(chrome.xp_delete_action || "").trim()}
        description={(chrome.xp_delete_confirm || "").trim()}
        cancelLabel={(chrome.xp_cancel_action || "").trim()}
        confirmLabel={(chrome.xp_delete_action || "").trim()}
        destructive
        onConfirm={() => {
          if (deleteIndex == null) return;
          setLevels((prev) => prev.filter((_, i) => i !== deleteIndex));
          setDeleteIndex(null);
        }}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => {
          if (!open) setBulkDeleteOpen(false);
        }}
        title={(chrome.xp_delete_action || "").trim()}
        description={(chrome.xp_delete_confirm || "").trim()}
        cancelLabel={(chrome.xp_cancel_action || "").trim()}
        confirmLabel={(chrome.xp_delete_action || "").trim()}
        destructive
        onConfirm={() => {
          const ids = new Set(selectedRowIds(rowSelection));
          if (!ids.size) return;
          setLevels((prev) => prev.filter((l, i) => !ids.has(`xp-${i}-${l.label}-${l.min_xp}`)));
          setRowSelection({});
          setBulkDeleteOpen(false);
        }}
      />
    </div>
  );
}
