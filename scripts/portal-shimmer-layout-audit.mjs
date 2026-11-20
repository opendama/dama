import fs from "node:fs";
import path from "node:path";

const root = "apps/web/src";
const checks = [
  ["app/(ads)/ads/dashboard/page.tsx", ['portalVariant="ads"']],
  ["app/(events)/events/dashboard/page.tsx", ["kpiCount={8}", 'portalVariant="events"']],
  ["app/(ads)/ads/analytics/page.tsx", ["denseKpis", "showPagination={false}"]],
  ["app/(events)/events/analytics/page.tsx", ["showPagination={false}"]],
  ["app/(ads)/ads/dashboard/page.tsx", ["showPagination", "h-5 w-40"]],
  ["app/(player)/profile/page.tsx", ["SkipPaginationSkeleton"]],
  ["components/wallet/TransactionsWorkspace.tsx", ["showBlurb={!portalMode}", "embedded"]],
  [
    "components/wallet/ReceiptsWorkspace.tsx",
    ["showManualForm={false}", "showBlurb={!portalMode}", "embedded"],
  ],
  ["components/wallet/WalletWorkspace.tsx", ["embedded"]],
  ["app/(ads)/ads/campaigns/page.tsx", ["embedded"]],
  ["app/(events)/events/events/page.tsx", ["embedded"]],
  ["components/events/EventsJoinPanel.tsx", ["EventsJoinSkeleton"]],
  ["app/(ads)/ads/transactions/page.tsx", ["showBlurb={false}"]],
  ["app/(events)/events/transactions/page.tsx", ["showBlurb={false}"]],
  ["app/(ads)/ads/receipts/page.tsx", ["showManualForm={false}", "showBlurb={false}"]],
  ["app/(events)/events/receipts/page.tsx", ["showManualForm={false}", "showBlurb={false}"]],
  ["app/(player)/settings/page.tsx", ["providersQuery.isLoading"]],
  ["components/auth/RequireAuth.tsx", ["portalRouteSkeleton"]],
  ["app/(ads)/ads/dashboard/page.tsx", ["showBody"]],
];

let fail = 0;
for (const [rel, need] of checks) {
  const t = fs.readFileSync(path.join(root, rel), "utf8");
  const missing = need.filter((n) => !t.includes(n));
  if (missing.length) {
    console.log("FAIL", rel, missing);
    fail++;
  } else {
    console.log("PASS", rel);
  }
}

const sk = fs.readFileSync(path.join(root, "components/ui/shimmer-skeletons.tsx"), "utf8");
for (const n of [
  "gap-4",
  "embedded = false",
  "showBlurb = true",
  "portalVariant",
  "dense = false",
  "actionCount = 2",
  "space-y-1.5",
  "min-w-[11rem]",
  "border-t border-[var(--dama-border)] p-3",
  "showBody",
  'density = "ops"',
  "export function portalRouteSkeleton",
  "export function SkipPaginationSkeleton",
  "showPagination={false}",
  // Hub browse grids (Tournaments / Community); join no longer paints a second grid.
  "TournamentCardGridSkeleton count={count}",
  "export function EventsHubSkeleton",
  "sm:min-w-[12rem]",
  'variant === "doc" && "space-y-3 p-4"',
  "sm:max-w-md",
  "h-9 w-32 rounded-md",
  "mt-1 h-8 w-40",
  "h-10 w-24 rounded-md",
  "h-10 w-40 rounded-md",
]) {
  if (!sk.includes(n)) {
    console.log("FAIL skeleton missing", n);
    fail++;
  } else {
    console.log("PASS sk", n);
  }
}

// Campaign list section must use space-y-2 (ads live parity)
const portalFn = sk.slice(
  sk.indexOf("export function PortalDashboardSkeleton"),
  sk.indexOf("export function PlayerDashboardSkeleton"),
);
if (!portalFn.includes('showCampaignList ? (\n        <section className="space-y-2">')) {
  // tolerate formatting variants
  if (!/showCampaignList \? \([\s\S]*?<section className="space-y-2">/.test(portalFn)) {
    console.log("FAIL PortalDashboardSkeleton campaign section not space-y-2");
    fail++;
  } else {
    console.log("PASS portal campaign space-y-2");
  }
} else {
  console.log("PASS portal campaign space-y-2");
}

const join = sk.slice(
  sk.indexOf("export function EventsJoinSkeleton"),
  sk.indexOf("export function DashboardPanelsSkeleton"),
);
if (join.includes("h-5 w-56")) {
  console.log("FAIL join still has event card shimmer");
  fail++;
} else {
  console.log("PASS join chrome has no event card");
}
if (
  !join.includes("space-y-1.5") ||
  !join.includes('ShimmerBlock className="h-10 w-full rounded-md"')
) {
  console.log("FAIL join Field not full-width space-y-1.5");
  fail++;
} else {
  console.log("PASS join Field full-width");
}
if (
  join.includes("TournamentFiltersSkeleton") ||
  join.includes("TournamentCardGridSkeleton") ||
  join.includes("SkipPaginationSkeleton")
) {
  console.log("FAIL join still paints second public browse grid shimmer");
  fail++;
} else if (
  !join.includes("rounded-xl border") ||
  !join.includes("h-5 w-48") ||
  !join.includes("mt-3 h-8 w-40")
) {
  console.log("FAIL join missing Community tournaments link shimmer");
  fail++;
} else {
  console.log("PASS join Community link shimmer (no second browse grid)");
}

const analyticsFn = sk.slice(
  sk.indexOf("export function AnalyticsPageSkeleton"),
  sk.indexOf("export function PortalDashboardSkeleton"),
);
if (!analyticsFn.includes("showPagination={false}")) {
  console.log("FAIL AnalyticsPageSkeleton still paints table pagination");
  fail++;
} else {
  console.log("PASS analytics table no pagination");
}

const listRowsFn = sk.slice(
  sk.indexOf("export function ListRowsSkeleton"),
  sk.indexOf("export function LeaderboardSkeleton"),
);
if (!listRowsFn.includes("showPagination") || !listRowsFn.includes("SkipPaginationSkeleton")) {
  console.log("FAIL ListRowsSkeleton missing optional SkipPagination");
  fail++;
} else {
  console.log("PASS ListRowsSkeleton optional pager");
}

const profileFn = sk.slice(
  sk.indexOf("export function ProfilePageSkeleton"),
  sk.indexOf("export function SettingsPageSkeleton"),
);
if (!profileFn.includes("rounded-md border") || !profileFn.includes("SkipPaginationSkeleton")) {
  console.log("FAIL ProfilePageSkeleton matches missing bordered rows + pager");
  fail++;
} else {
  console.log("PASS profile matches bordered + pager");
}

const filtersFn = sk.slice(
  sk.indexOf("export function TournamentFiltersSkeleton"),
  sk.indexOf("export function TournamentCardGridSkeleton"),
);
if (
  !filtersFn.includes("h-9 w-14") ||
  !filtersFn.includes("space-y-1.5") ||
  !filtersFn.includes("h-10 w-full")
) {
  console.log("FAIL TournamentFiltersSkeleton heights not Field/Button-sm parity");
  fail++;
} else {
  console.log("PASS TournamentFiltersSkeleton Field/Button-sm heights");
}

const settingsFn = sk.slice(
  sk.indexOf("export function SettingsPageSkeleton"),
  sk.indexOf("export function PortalMainSkeleton"),
);
if (
  !settingsFn.includes('variant === "doc" && "space-y-3 p-4"') ||
  !settingsFn.includes('variant === "cash" && "space-y-4 p-5"') ||
  !settingsFn.includes('variant === "account" && "space-y-6 p-5"')
) {
  console.log("FAIL SettingsPageSkeleton panel spacing variants");
  fail++;
} else {
  console.log("PASS SettingsPageSkeleton doc/cash/account spacing");
}

{
  const doc = fs.readFileSync(
    path.join(root, "components/compliance/DocumentKycPanel.tsx"),
    "utf8",
  );
  const cash = fs.readFileSync(
    path.join(root, "components/compliance/CashCompliancePanel.tsx"),
    "utf8",
  );
  const acct = fs.readFileSync(
    path.join(root, "components/legal/AccountComplianceSection.tsx"),
    "utf8",
  );
  const docLoad = doc.slice(
    doc.indexOf("chromeQuery.isLoading"),
    doc.indexOf("chromeQuery.isLoading") + 350,
  );
  const cashLoad = cash.slice(
    cash.indexOf("flagsQuery.isLoading"),
    cash.indexOf("flagsQuery.isLoading") + 400,
  );
  const acctLoad = acct.slice(
    acct.indexOf("chromeQuery.isLoading"),
    acct.indexOf("chromeQuery.isLoading") + 350,
  );
  if (!docLoad.includes("p-4") || docLoad.includes("shadow-[var(--dama-card-shadow)]")) {
    console.log("FAIL DocumentKycPanel soft-load not p-4 / still shadowed");
    fail++;
  } else {
    console.log("PASS soft-load DocumentKycPanel");
  }
  if (
    !cashLoad.includes("space-y-4") ||
    !cashLoad.includes("p-5") ||
    cashLoad.includes("shadow-[var(--dama-card-shadow)]")
  ) {
    console.log("FAIL CashCompliancePanel soft-load spacing/shadow");
    fail++;
  } else {
    console.log("PASS soft-load CashCompliancePanel");
  }
  if (
    !acctLoad.includes("space-y-6") ||
    !acctLoad.includes("p-5") ||
    acctLoad.includes("shadow-[var(--dama-card-shadow)]")
  ) {
    console.log("FAIL AccountComplianceSection soft-load spacing/shadow");
    fail++;
  } else {
    console.log("PASS soft-load AccountComplianceSection");
  }
}

{
  const walletFn = sk.slice(
    sk.indexOf("export function WalletPanelSkeleton"),
    sk.indexOf("export function ReceiptsPageSkeleton"),
  );
  if (!walletFn.includes("h-9 w-32 rounded-md")) {
    console.log("FAIL WalletPanelSkeleton Add CTA not h-9");
    fail++;
  } else {
    console.log("PASS WalletPanelSkeleton Add CTA h-9");
  }
}

const searchToolbar = sk.slice(
  sk.indexOf("export function SearchableListPageSkeleton"),
  sk.indexOf("export function CampaignListSkeleton"),
);
if (!searchToolbar.includes("sm:justify-between") || !searchToolbar.includes("sm:min-w-[12rem]")) {
  console.log("FAIL SearchableList toolbar missing justify-between / status min-w");
  fail++;
} else {
  console.log("PASS searchable toolbar justify-between + status min-w");
}
if (!searchToolbar.includes("sm:max-w-md")) {
  console.log("FAIL SearchableList constrainSearch not sm:max-w-md");
  fail++;
} else {
  console.log("PASS searchable sm:max-w-md");
}

const eventsListFn = sk.slice(
  sk.indexOf("export function EventsListSkeleton"),
  sk.indexOf("export function AnalyticsStatSkeleton"),
);
if (
  !eventsListFn.includes("constrainSearch={false}") ||
  !eventsListFn.includes("statusMinWidth={false}")
) {
  console.log("FAIL EventsListSkeleton must not use ads search/status width caps");
  fail++;
} else {
  console.log("PASS EventsListSkeleton unconstrained search/status");
}

const portalFnEvents = sk.slice(
  sk.indexOf("export function PortalDashboardSkeleton"),
  sk.indexOf("export function PlayerDashboardSkeleton"),
);
if (!portalFnEvents.includes("h-9 w-28 rounded-md")) {
  console.log("FAIL events portal pills not h-9 (Button sm)");
  fail++;
} else {
  console.log("PASS events portal pills h-9");
}

if (!filtersFn.includes("max-w-full")) {
  console.log("FAIL TournamentFiltersSkeleton search not max-w-full");
  fail++;
} else {
  console.log("PASS TournamentFiltersSkeleton search max-w-full");
}

{
  const doc = fs.readFileSync(
    path.join(root, "components/compliance/DocumentKycPanel.tsx"),
    "utf8",
  );
  const load = doc.slice(
    doc.indexOf("chromeQuery.isLoading"),
    doc.indexOf("chromeQuery.isLoading") + 550,
  );
  if (!load.includes("embedded") || !load.includes("overflow-visible")) {
    console.log("FAIL DocumentKycPanel soft-load ignores embedded");
    fail++;
  } else {
    console.log("PASS DocumentKycPanel embedded soft-load");
  }
}

// Field label present in SearchableListPageSkeleton
const searchFn = sk.slice(
  sk.indexOf("export function SearchableListPageSkeleton"),
  sk.indexOf("export function CampaignListSkeleton"),
);
if (!searchFn.includes("space-y-1.5") || !searchFn.includes("h-4 w-24")) {
  console.log("FAIL SearchableListPageSkeleton missing Field label rows");
  fail++;
} else {
  console.log("PASS searchable Field label rows");
}

// Entry pills h-9
if (!searchFn.includes("h-9 w-16")) {
  console.log("FAIL entry filter pills not h-9");
  fail++;
} else {
  console.log("PASS entry filter pills h-9");
}

const forbid = [
  ["app/(player)/transactions/page.tsx", "WalletPanelSkeleton"],
  ["app/(player)/receipts/page.tsx", "WalletPanelSkeleton"],
  ["app/(ads)/ads/transactions/page.tsx", "WalletPanelSkeleton"],
  ["app/(ads)/ads/receipts/page.tsx", "WalletPanelSkeleton"],
  ["app/(events)/events/transactions/page.tsx", "WalletPanelSkeleton"],
  ["app/(events)/events/receipts/page.tsx", "WalletPanelSkeleton"],
  ["components/events/EventsJoinPanel.tsx", "CampaignListSkeleton"],
  ["app/(events)/events/events/page.tsx", "CampaignListSkeleton"],
];
for (const [rel, bad] of forbid) {
  const t = fs.readFileSync(path.join(root, rel), "utf8");
  if (t.includes(bad)) {
    console.log("FAIL", rel, "still has", bad);
    fail++;
  } else {
    console.log("PASS no", bad, "in", path.basename(rel));
  }
}

console.log(fail ? `FAILED ${fail}` : "ALL REAUDIT CHECKS PASS");
process.exit(fail ? 1 : 0);
