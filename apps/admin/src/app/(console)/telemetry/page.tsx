"use client";

import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { SignInLink } from "@/components/auth/SignInLink";
import { GeoBrowseMap } from "@/components/map/GeoBrowseMap";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type OpsColumn,
  OpsDataTable,
  type OpsRowSelectionState,
} from "@/components/ui/ops-data-table";
import { OpsDataTableRowActions } from "@/components/ui/ops-data-table-row-actions";
import { TelemetryBodySkeleton, TelemetryPageSkeleton } from "@/components/ui/shimmer-skeletons";
import {
  useAdminAuditQuery,
  useAdminConsoleChromeQuery,
  useAdminFingerprintsQuery,
  useAdminGeoIpQuery,
} from "@/hooks/query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDeferredDialogValue } from "@/hooks/use-deferred-dialog-selection";
import { useIsConsoleRole } from "@/hooks/useIsConsoleRole";
import { useResetSkipOnChange } from "@/hooks/useResetSkipOnChange";
import { useUrlSkip } from "@/hooks/useUrlSkip";
import { chromeSeparator } from "@/lib/chrome-separator";
import { adminConsoleChromeUnavailable } from "@/lib/chrome-unavailable";
import { CountryFlag } from "@/lib/country-flag";
import { opsClearSelectionToolbar } from "@/lib/ops-table-selection";
import { parseListPageSize } from "@/lib/parse-list-page-size";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { isAdminConsoleChromeReady } from "@/types/admin-console-chrome";
import type { AuditRow, Fingerprint, GeoRow } from "@/types/console";
import { useEffect, useMemo, useState } from "react";

type TelemetryTab = "fingerprints" | "geo" | "audit";

type TelemetryDetail =
  | { kind: "fp"; row: Fingerprint }
  | { kind: "geo"; row: GeoRow }
  | { kind: "audit"; row: AuditRow };

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!(label || "").trim()) return null;
  return (
    <div className="min-w-0">
      <p className="text-xs text-[var(--dama-muted)]">{label}</p>
      <p className="break-words text-sm font-medium">{value}</p>
    </div>
  );
}

export default function AdminTelemetryPage() {
  const token = useAuthStore((s) => s.token);
  const { isConsole: isAdmin, isLoading: roleLoading } = useIsConsoleRole();
  const chromeQuery = useAdminConsoleChromeQuery(true);
  const chrome = isAdminConsoleChromeReady(chromeQuery.data)
    ? chromeQuery.data.telemetry
    : undefined;
  const pageSize = parseListPageSize(chrome?.list_page_size);

  const [tab, setTab] = useState<TelemetryTab>("fingerprints");
  const [fpSkip, setFpSkip] = useUrlSkip("fp_skip");
  const [geoSkip, setGeoSkip] = useUrlSkip("geo_skip");
  const [auditSkip, setAuditSkip] = useUrlSkip("audit_skip");
  const [fpSearch, setFpSearch] = useState("");
  const [geoSearch, setGeoSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [fpSelection, setFpSelection] = useState<OpsRowSelectionState>({});
  const [geoSelection, setGeoSelection] = useState<OpsRowSelectionState>({});
  const [auditSelection, setAuditSelection] = useState<OpsRowSelectionState>({});
  const debouncedFpSearch = useDebouncedValue(fpSearch.trim(), 250);
  const debouncedGeoSearch = useDebouncedValue(geoSearch.trim(), 250);
  const debouncedAuditSearch = useDebouncedValue(auditSearch.trim(), 250);
  const listEnabled = isAdmin && pageSize > 0;
  useResetSkipOnChange(setFpSkip, [debouncedFpSearch]);
  useResetSkipOnChange(setGeoSkip, [debouncedGeoSearch]);
  useResetSkipOnChange(setAuditSkip, [debouncedAuditSearch]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: clear selection when list context changes
  useEffect(() => {
    setFpSelection({});
  }, [debouncedFpSearch, fpSkip]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: clear selection when list context changes
  useEffect(() => {
    setGeoSelection({});
  }, [debouncedGeoSearch, geoSkip]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: clear selection when list context changes
  useEffect(() => {
    setAuditSelection({});
  }, [debouncedAuditSearch, auditSkip]);
  const fps = useAdminFingerprintsQuery(token, listEnabled, fpSkip, pageSize, debouncedFpSearch);
  const geo = useAdminGeoIpQuery(token, listEnabled, geoSkip, pageSize, debouncedGeoSearch);
  const audit = useAdminAuditQuery(token, listEnabled, auditSkip, pageSize, debouncedAuditSearch);
  const detailDialog = useDeferredDialogValue<TelemetryDetail>();

  // Server already applied q - do not re-filter the loaded page.
  const fpRows = fps.data?.fingerprints ?? [];
  const geoRows = geo.data?.geo_ip_records ?? [];

  const geoMapPins = useMemo(() => {
    return geoRows
      .filter((g) => {
        const lat = g.latitude;
        const lng = g.longitude;
        // Store COALESCE(missing,0) - treat null-island 0,0 as absent (no invent).
        return (
          typeof lat === "number" &&
          Number.isFinite(lat) &&
          typeof lng === "number" &&
          Number.isFinite(lng) &&
          (lat !== 0 || lng !== 0)
        );
      })
      .map((g) => ({
        id: g.id,
        lat: g.latitude as number,
        lng: g.longitude as number,
        title: [g.username, g.country_code, g.city, g.ip]
          .filter(Boolean)
          .join(chromeSeparator(chrome?.meta_separator)),
      }));
  }, [chrome?.meta_separator, geoRows]);

  const auditRows = audit.data?.audit ?? [];

  const telemetryLoading = roleLoading || fps.isLoading || geo.isLoading || audit.isLoading;
  const softFetching =
    (fps.isFetching && !fps.isLoading) ||
    (geo.isFetching && !geo.isLoading) ||
    (audit.isFetching && !audit.isLoading);

  const empty = (chrome?.empty_value || "").trim();

  const fpColumns = useMemo((): OpsColumn<Fingerprint>[] => {
    if (!chrome) return [];
    const viewLabel = (chrome.view_detail_action || "").trim();
    const actionsLabel = (chrome.row_actions_label || "").trim();
    const cols: OpsColumn<Fingerprint>[] = [
      {
        id: "user",
        header: (chrome.col_user || "").trim(),
        cell: (f: Fingerprint) => (
          <span className="font-medium">{(f.username || "").trim() || empty}</span>
        ),
      },
      {
        id: "fingerprint",
        header: (chrome.col_fingerprint || "").trim(),
        cell: (f: Fingerprint) => (
          <span className="break-all font-mono text-xs text-[var(--dama-muted)]">
            {(f.fingerprint || "").trim() || empty}
          </span>
        ),
      },
      {
        id: "platform",
        header: (chrome.col_platform || "").trim(),
        cell: (f: Fingerprint) => (
          <span className="text-sm text-[var(--dama-muted)]">
            {(f.platform || "").trim() || empty}
          </span>
        ),
      },
      {
        id: "ip",
        header: (chrome.col_ip || "").trim(),
        cell: (f: Fingerprint) => (
          <span className="font-mono text-xs text-[var(--dama-muted)]">
            {(f.ip_hint || "").trim() || empty}
          </span>
        ),
      },
      {
        id: "seen",
        header: (chrome.col_seen || "").trim(),
        cell: (f: Fingerprint) => (
          <span className="text-xs text-[var(--dama-muted)]">
            {f.last_seen_at ? new Date(f.last_seen_at).toLocaleString() : empty}
          </span>
        ),
      },
      ...(viewLabel
        ? [
            {
              id: "view",
              header: viewLabel,
              className: "w-24",
              cell: (f: Fingerprint) => (
                <button
                  type="button"
                  className="text-left text-sm underline-offset-4 hover:underline"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => detailDialog.openWith({ kind: "fp", row: f })}
                >
                  {viewLabel}
                </button>
              ),
            } satisfies OpsColumn<Fingerprint>,
          ]
        : []),
      {
        id: "actions",
        header: actionsLabel,
        className: "w-12 text-right",
        cell: (f: Fingerprint) => (
          <OpsDataTableRowActions
            triggerLabel={actionsLabel}
            actions={[
              {
                id: "view",
                label: viewLabel,
                onSelect: () => detailDialog.openWith({ kind: "fp", row: f }),
              },
            ]}
          />
        ),
      },
    ];
    return cols.filter((c) => c.id === "actions" || Boolean(c.header));
  }, [chrome, detailDialog, empty]);

  const geoColumns = useMemo((): OpsColumn<GeoRow>[] => {
    if (!chrome) return [];
    const viewLabel = (chrome.view_detail_action || "").trim();
    const actionsLabel = (chrome.row_actions_label || "").trim();
    const cols: OpsColumn<GeoRow>[] = [
      {
        id: "user",
        header: (chrome.col_user || "").trim(),
        cell: (g: GeoRow) => (
          <span className="font-medium">{(g.username || "").trim() || empty}</span>
        ),
      },
      {
        id: "country",
        header: (chrome.col_country || "").trim(),
        cell: (g: GeoRow) =>
          g.country_code ? (
            <span className="inline-flex items-center gap-1 text-sm">
              <CountryFlag code={g.country_code} />
              <span>{g.country_code}</span>
            </span>
          ) : (
            <span className="text-sm">{empty}</span>
          ),
      },
      {
        id: "region",
        header: (chrome.col_region || "").trim(),
        cell: (g: GeoRow) => (
          <span className="text-sm text-[var(--dama-muted)]">
            {(g.region || "").trim() || empty}
          </span>
        ),
      },
      {
        id: "city",
        header: (chrome.col_city || "").trim(),
        cell: (g: GeoRow) => (
          <span className="text-sm text-[var(--dama-muted)]">{(g.city || "").trim() || empty}</span>
        ),
      },
      {
        id: "ip",
        header: (chrome.col_ip || "").trim(),
        cell: (g: GeoRow) => (
          <span className="font-mono text-xs text-[var(--dama-muted)]">
            {(g.ip || "").trim() || empty}
          </span>
        ),
      },
      {
        id: "source",
        header: (chrome.col_source || "").trim(),
        cell: (g: GeoRow) => (
          <span className="text-sm text-[var(--dama-muted)]">
            {(g.source || "").trim() || empty}
          </span>
        ),
      },
      ...(viewLabel
        ? [
            {
              id: "view",
              header: viewLabel,
              className: "w-24",
              cell: (g: GeoRow) => (
                <button
                  type="button"
                  className="text-left text-sm underline-offset-4 hover:underline"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => detailDialog.openWith({ kind: "geo", row: g })}
                >
                  {viewLabel}
                </button>
              ),
            } satisfies OpsColumn<GeoRow>,
          ]
        : []),
      {
        id: "actions",
        header: actionsLabel,
        className: "w-12 text-right",
        cell: (g: GeoRow) => (
          <OpsDataTableRowActions
            triggerLabel={actionsLabel}
            actions={[
              {
                id: "view",
                label: viewLabel,
                onSelect: () => detailDialog.openWith({ kind: "geo", row: g }),
              },
            ]}
          />
        ),
      },
    ];
    return cols.filter((c) => c.id === "actions" || Boolean(c.header));
  }, [chrome, detailDialog, empty]);

  const auditColumns = useMemo((): OpsColumn<AuditRow>[] => {
    if (!chrome) return [];
    const viewLabel = (chrome.view_detail_action || "").trim();
    const actionsLabel = (chrome.row_actions_label || "").trim();
    const cols: OpsColumn<AuditRow>[] = [
      {
        id: "when",
        header: (chrome.col_when || "").trim(),
        cell: (a: AuditRow) => (
          <span className="font-mono text-xs">
            {a.created_at ? new Date(a.created_at).toLocaleString() : empty}
          </span>
        ),
      },
      {
        id: "action",
        header: (chrome.col_action || "").trim(),
        cell: (a: AuditRow) => (
          <span className="font-mono text-xs">{(a.action || "").trim() || empty}</span>
        ),
      },
      {
        id: "entity",
        header: (chrome.col_entity || "").trim(),
        cell: (a: AuditRow) => (
          <span className="font-mono text-xs text-[var(--dama-muted)]">
            {(a.entity_type || "").trim() || empty}
          </span>
        ),
      },
      {
        id: "actor",
        header: (chrome.col_actor || "").trim(),
        cell: (a: AuditRow) => (
          <span className="font-mono text-xs text-[var(--dama-muted)]">
            {(a.actor_id || "").trim() || empty}
          </span>
        ),
      },
      ...(viewLabel
        ? [
            {
              id: "view",
              header: viewLabel,
              className: "w-24",
              cell: (a: AuditRow) => (
                <button
                  type="button"
                  className="text-left text-sm underline-offset-4 hover:underline"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => detailDialog.openWith({ kind: "audit", row: a })}
                >
                  {viewLabel}
                </button>
              ),
            } satisfies OpsColumn<AuditRow>,
          ]
        : []),
      {
        id: "actions",
        header: actionsLabel,
        className: "w-12 text-right",
        cell: (a: AuditRow) => (
          <OpsDataTableRowActions
            triggerLabel={actionsLabel}
            actions={[
              {
                id: "view",
                label: viewLabel,
                onSelect: () => detailDialog.openWith({ kind: "audit", row: a }),
              },
            ]}
          />
        ),
      },
    ];
    return cols.filter((c) => c.id === "actions" || Boolean(c.header));
  }, [chrome, detailDialog, empty]);

  if (chromeQuery.isLoading) {
    return (
      <div className="space-y-4">
        <TelemetryPageSkeleton tab={tab} />
      </div>
    );
  }

  if (!chrome) {
    return (
      <div className="p-6 text-sm text-[var(--dama-muted)]">
        {adminConsoleChromeUnavailable(chromeQuery.data, chromeQuery.error)}
      </div>
    );
  }

  if (roleLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{chrome.page_title}</h1>
          <p className="mt-1 text-sm text-[var(--dama-muted)]">{chrome.page_blurb}</p>
        </div>
        <TelemetryBodySkeleton tab={tab} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">{chrome.page_title_short}</h1>
        <p className="text-sm text-[var(--dama-muted)]">
          <SignInLink className="text-[var(--dama-gold)] underline" />
        </p>
      </div>
    );
  }

  const closeLabel = (chrome.dialog_close_label || "").trim();
  const cancelLabel = (chrome.cancel_action || "").trim();
  const detail = detailDialog.value;
  const detailTitle = detail
    ? detail.kind === "fp"
      ? (chrome.fp_detail_title || "").trim()
      : detail.kind === "geo"
        ? (chrome.geo_detail_title || "").trim()
        : (chrome.audit_detail_title || "").trim()
    : "";
  const searchPlaceholder = (chrome.search_placeholder || "").trim() || undefined;
  const tabFingerprints = (chrome.fingerprints_title || "").trim();
  const tabGeo = (chrome.geo_title || "").trim();
  const tabAudit = (chrome.audit_title || "").trim();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{chrome.page_title}</h1>
        <p className="mt-1 text-sm text-[var(--dama-muted)]">{chrome.page_blurb}</p>
      </div>

      {telemetryLoading ? (
        <TelemetryBodySkeleton tab={tab} />
      ) : (
        <>
          <div
            role="tablist"
            aria-label={(chrome.page_title || "").trim() || undefined}
            className="flex max-w-full flex-wrap gap-1 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-surface)] p-1"
          >
            {(
              [
                { id: "fingerprints" as const, label: tabFingerprints },
                { id: "geo" as const, label: tabGeo },
                { id: "audit" as const, label: tabAudit },
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

          {tab === "fingerprints" ? (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--dama-muted)]">
                {chrome.fingerprints_title}
              </h2>
              <AdminFilterBar
                filters={[
                  {
                    kind: "search",
                    id: "admin-fp-search",
                    label: (chrome.search_label || "").trim(),
                    value: fpSearch,
                    onChange: setFpSearch,
                    placeholder: searchPlaceholder,
                  },
                ]}
              />
              <OpsDataTable
                columns={fpColumns}
                data={fpRows}
                getRowId={(f) => f.id}
                isFetching={softFetching}
                meta={fps.data?.meta}
                onPage={setFpSkip}
                pageDisabled={softFetching}
                pageInputId="admin-fp-skip"
                empty={<span>{chrome.no_fingerprints}</span>}
                selection={opsClearSelectionToolbar(chrome, fpSelection, setFpSelection)}
              />
            </section>
          ) : null}

          {tab === "geo" ? (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--dama-muted)]">
                {chrome.geo_title}
              </h2>
              <AdminFilterBar
                filters={[
                  {
                    kind: "search",
                    id: "admin-geo-search",
                    label: (chrome.search_label || "").trim(),
                    value: geoSearch,
                    onChange: setGeoSearch,
                    placeholder: searchPlaceholder,
                  },
                ]}
              />
              <OpsDataTable
                columns={geoColumns}
                data={geoRows}
                getRowId={(g) => g.id}
                isFetching={softFetching}
                meta={geo.data?.meta}
                onPage={setGeoSkip}
                pageDisabled={softFetching}
                pageInputId="admin-geo-skip"
                empty={<span>{chrome.no_geo}</span>}
                selection={opsClearSelectionToolbar(chrome, geoSelection, setGeoSelection)}
              />
              {(chrome.map_title || "").trim() ? (
                <div className="space-y-2 pt-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--dama-muted)]">
                    {chrome.map_title}
                  </h3>
                  <GeoBrowseMap
                    pins={geoMapPins}
                    emptyTitle={(chrome.map_empty_title || "").trim()}
                    emptyBody={(chrome.map_empty_body || "").trim()}
                    listingsCountFmt={(chrome.map_listings_count_fmt || "").trim() || undefined}
                    footerHint={(chrome.map_footer_hint || "").trim() || undefined}
                  />
                </div>
              ) : null}
            </section>
          ) : null}

          {tab === "audit" ? (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--dama-muted)]">
                {chrome.audit_title}
              </h2>
              <AdminFilterBar
                filters={[
                  {
                    kind: "search",
                    id: "admin-audit-search",
                    label: (chrome.search_label || "").trim(),
                    value: auditSearch,
                    onChange: setAuditSearch,
                    placeholder: searchPlaceholder,
                  },
                ]}
              />
              <OpsDataTable
                columns={auditColumns}
                data={auditRows}
                getRowId={(a) => a.id}
                isFetching={softFetching}
                meta={audit.data?.meta}
                onPage={setAuditSkip}
                pageDisabled={softFetching}
                pageInputId="admin-audit-skip"
                empty={<span>{chrome.no_audit}</span>}
                selection={opsClearSelectionToolbar(chrome, auditSelection, setAuditSelection)}
              />
            </section>
          ) : null}
        </>
      )}

      {detail && detailTitle && closeLabel ? (
        <Dialog open={detailDialog.open} onOpenChange={detailDialog.onOpenChange}>
          <DialogContent closeLabel={closeLabel} className="max-w-lg sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{detailTitle}</DialogTitle>
              <DialogDescription className="sr-only">{detailTitle}</DialogDescription>
            </DialogHeader>
            {detail.kind === "fp" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailRow
                  label={(chrome.col_user || "").trim()}
                  value={(detail.row.username || "").trim() || empty}
                />
                <DetailRow
                  label={(chrome.col_platform || "").trim()}
                  value={(detail.row.platform || "").trim() || empty}
                />
                <DetailRow
                  label={(chrome.col_fingerprint || "").trim()}
                  value={(detail.row.fingerprint || "").trim() || empty}
                />
                <DetailRow
                  label={(chrome.col_ip || "").trim()}
                  value={(detail.row.ip_hint || "").trim() || empty}
                />
                <DetailRow
                  label={(chrome.detail_user_id_label || "").trim()}
                  value={(detail.row.user_id || "").trim() || empty}
                />
                <DetailRow
                  label={(chrome.col_seen || "").trim()}
                  value={
                    detail.row.last_seen_at
                      ? new Date(detail.row.last_seen_at).toLocaleString()
                      : empty
                  }
                />
                <DetailRow
                  label={(chrome.col_when || "").trim()}
                  value={
                    detail.row.created_at ? new Date(detail.row.created_at).toLocaleString() : empty
                  }
                />
                <DetailRow
                  label={(chrome.col_user_agent || "").trim()}
                  value={(detail.row.user_agent || "").trim() || empty}
                />
              </div>
            ) : null}
            {detail.kind === "geo" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailRow
                  label={(chrome.col_user || "").trim()}
                  value={(detail.row.username || "").trim() || empty}
                />
                <DetailRow
                  label={(chrome.col_country || "").trim()}
                  value={(detail.row.country_code || "").trim() || empty}
                />
                <DetailRow
                  label={(chrome.col_region || "").trim()}
                  value={(detail.row.region || "").trim() || empty}
                />
                <DetailRow
                  label={(chrome.col_city || "").trim()}
                  value={(detail.row.city || "").trim() || empty}
                />
                <DetailRow
                  label={(chrome.col_ip || "").trim()}
                  value={(detail.row.ip || "").trim() || empty}
                />
                <DetailRow
                  label={(chrome.col_source || "").trim()}
                  value={(detail.row.source || "").trim() || empty}
                />
                <DetailRow
                  label={(chrome.col_coords || "").trim()}
                  value={
                    typeof detail.row.latitude === "number" &&
                    typeof detail.row.longitude === "number" &&
                    Number.isFinite(detail.row.latitude) &&
                    Number.isFinite(detail.row.longitude) &&
                    (detail.row.latitude !== 0 || detail.row.longitude !== 0)
                      ? `${detail.row.latitude.toFixed(5)}, ${detail.row.longitude.toFixed(5)}`
                      : empty
                  }
                />
                <DetailRow
                  label={(chrome.detail_user_id_label || "").trim()}
                  value={(detail.row.user_id || "").trim() || empty}
                />
                <DetailRow
                  label={(chrome.col_when || "").trim()}
                  value={
                    detail.row.created_at ? new Date(detail.row.created_at).toLocaleString() : empty
                  }
                />
              </div>
            ) : null}
            {detail.kind === "audit" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailRow
                  label={(chrome.col_when || "").trim()}
                  value={
                    detail.row.created_at ? new Date(detail.row.created_at).toLocaleString() : empty
                  }
                />
                <DetailRow
                  label={(chrome.col_action || "").trim()}
                  value={(detail.row.action || "").trim() || empty}
                />
                <DetailRow
                  label={(chrome.col_entity || "").trim()}
                  value={(detail.row.entity_type || "").trim() || empty}
                />
                <DetailRow
                  label={(chrome.detail_id_label || "").trim()}
                  value={(detail.row.entity_id || "").trim() || empty}
                />
                <DetailRow
                  label={(chrome.col_actor || "").trim()}
                  value={(detail.row.actor_id || "").trim() || empty}
                />
                {detail.row.meta != null ? (
                  <div className="min-w-0 sm:col-span-2">
                    <p className="break-all font-mono text-xs text-[var(--dama-muted)]">
                      {JSON.stringify(detail.row.meta)}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
            <DialogFooter>
              {cancelLabel ? (
                <Button type="button" variant="outline" onClick={() => detailDialog.close()}>
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
