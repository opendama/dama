/**
 * Static audit: admin UI must match Trim-aligned checklist (fail closed).
 * Run: node scripts/admin-ui-parity-audit.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "apps", "admin", "src");
const fails = [];
const ok = [];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function assert(cond, msg) {
  if (cond) ok.push(msg);
  else fails.push(msg);
}

const shell = read("components/console/AdminConsoleShell.tsx");
assert(!shell.includes("ConsoleLegalLinks"), "header: Privacy/Terms/Refunds removed");
assert(
  shell.includes("w-full flex-1") && !/max-w-\[(2xl|3xl|4xl|5xl|6xl|7xl)\]/.test(shell),
  "shell: full-width main (no nested max-w shrink)",
);
assert(shell.includes("AdminUserMenu"), "header: AdminUserMenu present");

const menu = read("components/auth/AdminUserMenu.tsx");
assert(!menu.includes("admin_login_title"), "user menu: no Console sign-in / login title link");
assert(!menu.includes('href="/dashboard"'), "user menu: no dashboard link disguised as login");
assert(
  menu.includes("oauthProfile") || menu.includes("stored"),
  "user menu: uses persisted OAuth profile",
);
assert(menu.includes("avatarUrl") || menu.includes("avatar"), "user menu: avatar support");
assert(menu.includes("signOut"), "user menu: Sign out only action");
assert(menu.includes('referrerPolicy="no-referrer"'), "user menu: Google avatar referrerPolicy");
assert(
  menu.includes("min-w-0 flex-1 truncate font-medium"),
  "user menu: name always visible (Trim)",
);
assert(
  !menu.includes("hidden min-w-0 truncate font-medium sm:inline"),
  "user menu: not sm-only name",
);

const dash = read("app/(console)/dashboard/page.tsx");
assert(!dash.includes("useSignOutMutation"), "overview: no page Sign out button");
assert(!dash.includes("modules.map"), "overview: no module card grid");
assert(dash.includes("KpiCard"), "overview: KPI cards");
assert(!dash.includes("kpi_signed_in"), "overview: no signed-in KPI");
assert(!dash.includes("signed_in_joiner"), "overview: no signed_in_joiner");

const dashChrome = read("types/admin-console-chrome.ts");
assert(!dashChrome.includes('"signed_in_joiner"'), "chrome types: signed_in_joiner removed");
assert(!dashChrome.includes('"kpi_signed_in_label"'), "chrome types: kpi_signed_in_label removed");

const checkbox = read("components/ui/checkbox.tsx");
assert(checkbox.includes("@radix-ui/react-checkbox"), "checkbox: Radix shadcn");
assert(checkbox.includes("dama-gold"), "checkbox: gold checked (not OS blue)");

const table = read("components/ui/table.tsx");
assert(table.includes("whitespace-nowrap"), "table headers: whitespace-nowrap");

const ops = read("components/ui/ops-data-table.tsx");
assert(ops.includes('from "@/components/ui/checkbox"'), "ops table: Checkbox selection");
assert(ops.includes("whitespace-nowrap"), "ops table: nowrap headers");
assert(
  ops.includes('c.id === "actions"') || ops.includes('id.startsWith("_")'),
  "ops table: keeps empty-header action columns",
);
assert(
  !/columns\.filter\(\(c\) => c\.header\.trim\(\)\)/.test(ops),
  "ops table: does not drop empty headers",
);

const menuName = read("components/auth/AdminUserMenu.tsx");
assert(
  !menuName.includes("meQuery.data?.username"),
  "user menu: no username fallback for display name",
);
assert(!menuName.includes("avatarThumbUrl"), "user menu: Google avatar only (no meQuery avatar)");
assert(!menuName.includes("useMeQuery"), "user menu: no useMeQuery");

const selectUi = read("components/ui/select.tsx");
assert(selectUi.includes("dama-gold"), "select: gold check indicator");

const kpi = read("components/ui/kpi-card.tsx");
assert(kpi.includes("href ?") && kpi.includes("hover:bg-"), "kpi: hover only when linked");
assert(kpi.includes("p-6"), "kpi: Trim Card padding p-6");
assert(kpi.includes("font-medium uppercase"), "kpi: Trim label weight");
assert(kpi.includes("LucideIcon") || kpi.includes("icon:"), "kpi: Smart Menu icon slot");

const field = read("components/ui/field.tsx");
assert(field.includes('from "@/components/ui/label"'), "field: Radix Label");
assert(field.includes("min-h-5"), "field: reserved description line");
assert(field.includes("min-h-10"), "field: control min-h-10");

const usersCols = read("app/(console)/users/page.tsx");
assert(usersCols.includes('header: ""'), "users: empty actions column header (Trim)");
assert(usersCols.includes('kind: "dateRange"'), "users: Trim dateRange filter");
const avatarsCols = read("app/(console)/avatars/page.tsx");
assert(avatarsCols.includes('header: ""'), "avatars: empty actions column header (Trim)");
const mediaCols = read("app/(console)/media-pool/page.tsx");
assert(mediaCols.includes('header: ""'), "media-pool: empty actions column header (Trim)");
const paymentsCols = read("app/(console)/payments/page.tsx");
assert(
  (paymentsCols.match(/id:\s*"actions"[\s\S]*?header:\s*""/g) || []).length >= 3,
  "payments: empty actions column headers (Trim)",
);
const rbacCols = read("app/(console)/rbac/page.tsx");
assert(
  rbacCols.includes('id: "actions"') && rbacCols.includes('header: ""'),
  "rbac: empty actions header (Trim)",
);

const filterBar = read("components/admin/admin-filter-bar.tsx");
assert(filterBar.includes("SelectTrigger"), "filter bar: shadcn Select");
assert(
  filterBar.includes('kind: "dateRange"') || filterBar.includes("dateRange"),
  "filter bar: dateRange kind",
);
assert(existsSync(join(root, "components/ui/date-range-picker.tsx")), "date-range-picker present");

const webMenu = readFileSync(
  join(root, "..", "..", "web", "src", "components", "auth", "PlayerUserMenu.tsx"),
  "utf8",
);
assert(!webMenu.includes("avatarThumbUrl"), "web: PlayerUserMenu OAuth avatar only");

const consoleFiles = walk(join(root, "app", "(console)"));
let nativeCheckbox = 0;
let nativeSelect = 0;
let narrowMax = 0;
for (const f of consoleFiles) {
  const t = readFileSync(f, "utf8");
  if (/type=["']checkbox["']/.test(t)) nativeCheckbox++;
  if (/<select[\s>]/.test(t)) nativeSelect++;
  if (/mx-auto max-w-(2xl|3xl|4xl)/.test(t)) narrowMax++;
}
assert(nativeCheckbox === 0, `console pages: zero native checkboxes (found ${nativeCheckbox})`);
assert(nativeSelect === 0, `console pages: zero native <select> (found ${nativeSelect})`);
assert(narrowMax === 0, `console pages: zero nested max-w-2/3/4xl (found ${narrowMax})`);

const users = read("app/(console)/users/page.tsx");
assert(users.includes("AdminFilterBar"), "users: AdminFilterBar");
const banks = read("app/(console)/banks/page.tsx");
assert(banks.includes("AdminFilterBar"), "banks: AdminFilterBar");
const payments = read("app/(console)/payments/page.tsx");
assert(payments.includes("AdminFilterBar"), "payments: AdminFilterBar KYC filter");
const avatars = read("app/(console)/avatars/page.tsx");
assert(avatars.includes("AdminFilterBar"), "avatars: AdminFilterBar");
const rbac = read("app/(console)/rbac/page.tsx");
assert(rbac.includes("AdminFilterBar"), "rbac: AdminFilterBar");
assert(
  read("components/ui/shimmer-skeletons.tsx").includes("BanksListSkeleton") &&
    read("components/ui/shimmer-skeletons.tsx").match(/BanksListSkeleton[\s\S]*FilterBarSkeleton/),
  "skeletons: BanksListSkeleton includes FilterBarSkeleton",
);

const skel = read("components/ui/shimmer-skeletons.tsx");
assert(skel.includes("FilterBarSkeleton"), "skeletons: FilterBarSkeleton");
assert(
  skel.includes("xl:grid-cols-5") || skel.includes("DashboardCardsSkeleton"),
  "skeletons: KPI overview shape",
);

console.log(`PASS ${ok.length}`);
for (const m of ok) console.log(`  ✓ ${m}`);
if (fails.length) {
  console.log(`\nFAIL ${fails.length}`);
  for (const m of fails) console.log(`  ✗ ${m}`);
  process.exit(1);
}
console.log("\nAll admin UI parity checks passed.");
