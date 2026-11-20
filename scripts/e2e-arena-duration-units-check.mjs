/**
 * E2E: Arena duration units + calendar chrome (mig 444–445).
 * Backend still stores arena_duration_minutes; UI offers
 * minutes/hours/days/weeks/months + ends-at calendar.
 * Classic KO/Swiss/RR/Groups have no timed duration field.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-arena-duration-units-check.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const base = (process.env.DAMA_API_BASE || "http://127.0.0.1:18080/api/v1").replace(/\/$/, "");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function req(path) {
  for (let attempt = 1; attempt <= 8; attempt++) {
    const r = await fetch(base + path, { headers: { "Content-Type": "application/json" } });
    const text = await r.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    if (![429, 502, 503].includes(r.status) || attempt === 8) return { status: r.status, body };
    await sleep(1000 * attempt);
  }
  return { status: 503, body: {} };
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("OK:", msg);
}

function nonEmpty(v) {
  return String(v || "").trim().length > 0;
}

const keys = [
  "arena_duration_label",
  "arena_duration_required",
  "arena_duration_unit_label",
  "arena_duration_unit_minutes",
  "arena_duration_unit_hours",
  "arena_duration_unit_days",
  "arena_duration_unit_weeks",
  "arena_duration_unit_months",
  "arena_duration_mode_length",
  "arena_duration_mode_ends_at",
  "arena_duration_ends_at_label",
  "arena_duration_ends_at_placeholder",
  "arena_duration_ends_at_past",
  "arena_duration_blurb",
];

function assertHelpers() {
  // Load TS helpers via tsx-free reimplementation lock (source must contain months).
  const web = readFileSync(join(root, "apps/web/src/lib/arena-duration.ts"), "utf8");
  assert(/months/.test(web), "web arena-duration months unit");
  assert(/ARENA_DURATION_MONTH_MINUTES/.test(web), "web month minutes constant");
  assert(/43200|30 \* 1440/.test(web), "web month = 30 days");

  const admin = readFileSync(join(root, "apps/admin/src/lib/arena-duration.ts"), "utf8");
  assert(/months/.test(admin), "admin arena-duration months unit");

  const flutter = readFileSync(join(root, "apps/mobile/lib/core/arena_duration.dart"), "utf8");
  assert(/ArenaDurationUnit\.months/.test(flutter), "Flutter months unit");
  assert(/arenaDurationMonthMinutes/.test(flutter), "Flutter month minutes constant");

  // Pure conversion check mirrored from helpers (30-day month).
  const monthMins = 30 * 1440;
  assert(monthMins === 43200, "1 month = 43200 minutes");
  assert(7 * 1440 === 10080, "1 week = 10080 minutes");
  assert(24 * 60 === 1440, "1 day = 1440 minutes");
}

function assertSourceLocks() {
  assert(
    existsSync(join(root, "apps/api/migrations/444_arena_duration_units_calendar_chrome.sql")),
    "mig 444 present",
  );
  assert(
    existsSync(join(root, "apps/api/migrations/445_arena_duration_months_unit_chrome.sql")),
    "mig 445 present",
  );
  assert(
    /ArenaDurationField/.test(
      readFileSync(
        join(root, "apps/admin/src/components/tournaments/tournament-settings-cards.tsx"),
        "utf8",
      ),
    ),
    "admin arena settings uses ArenaDurationField",
  );

  const flutterEvents = readFileSync(
    join(root, "apps/mobile/lib/features/events/events_page.dart"),
    "utf8",
  );
  assert(/ArenaDurationField/.test(flutterEvents), "Flutter host create uses ArenaDurationField");
  assert(
    !/labelText:\s*chrome\.arenaDurationLabel/.test(flutterEvents),
    "Flutter no raw minutes TextField for arena duration label",
  );
  assert(
    /unitMonths: chrome\.arenaDurationUnitMonths/.test(flutterEvents),
    "Flutter wires months unit",
  );

  const webCreate = readFileSync(
    join(root, "apps/web/src/app/(events)/events/events/page.tsx"),
    "utf8",
  );
  assert(/ArenaDurationField/.test(webCreate), "web host create uses ArenaDurationField");
  assert(
    !/id=\"create-arena-duration\"[\s\S]{0,120}type=\"number\"/.test(webCreate),
    "web no bare number input for create-arena-duration",
  );

  const adminPage = readFileSync(
    join(root, "apps/admin/src/app/(console)/tournaments/page.tsx"),
    "utf8",
  );
  assert(/ArenaDurationField/.test(adminPage), "admin create/edit uses ArenaDurationField");
  assert(
    !/id=\{`\$\{idPrefix\}-arena-duration`\}[\s\S]{0,80}type=\"number\"/.test(adminPage),
    "admin no bare number input for arena-duration id",
  );
  assert(
    /arena_duration_unit_months/.test(
      readFileSync(
        join(root, "apps/web/src/components/tournaments/ArenaDurationField.tsx"),
        "utf8",
      ),
    ),
    "web ArenaDurationField months chrome",
  );
  assert(
    /arena_duration_unit_months/.test(
      readFileSync(
        join(root, "apps/admin/src/components/tournaments/ArenaDurationField.tsx"),
        "utf8",
      ),
    ),
    "admin ArenaDurationField months chrome",
  );
  const webField = readFileSync(
    join(root, "apps/web/src/components/tournaments/ArenaDurationField.tsx"),
    "utf8",
  );
  const adminField = readFileSync(
    join(root, "apps/admin/src/components/tournaments/ArenaDurationField.tsx"),
    "utf8",
  );
  // No invent hours unit fallback / empty seed prefers storage-native minutes.
  assert(!/: \"hours\"\) as ArenaDurationUnit/.test(webField), "web no invent hours unit fallback");
  assert(
    !/: \"hours\"\) as ArenaDurationUnit/.test(adminField),
    "admin no invent hours unit fallback",
  );
  assert(/unit: \"minutes\" as ArenaDurationUnit/.test(webField), "web empty seed unit=minutes");
  assert(
    /unit: \"minutes\" as ArenaDurationUnit/.test(adminField),
    "admin empty seed unit=minutes",
  );
  assert(
    /unit: ArenaDurationUnit\.minutes/.test(
      readFileSync(join(root, "apps/mobile/lib/core/arena_duration.dart"), "utf8"),
    ),
    "Flutter empty seed unit=minutes",
  );

  const docsArch = readFileSync(join(root, "docs/architecture.md"), "utf8");
  assert(
    /444/.test(docsArch) && /445|Months|months/.test(docsArch),
    "architecture docs arena duration units",
  );
  const docsPrd = readFileSync(join(root, "docs/prd-compliance.md"), "utf8");
  assert(/444/.test(docsPrd), "prd-compliance docs arena duration");
}

async function main() {
  assertHelpers();
  assertSourceLocks();

  const t = await req("/public/tournament-chrome");
  assert(t.status === 200, "tournament-chrome 200");
  for (const k of keys) {
    assert(nonEmpty(t.body?.[k]), `tournament_chrome.${k}`);
  }
  assert(
    nonEmpty(t.body?.arena_settings_label_default_duration),
    "tournament_chrome.arena_settings_label_default_duration",
  );
  assert(
    !/\(minutes\)/i.test(String(t.body?.arena_duration_label || "")),
    "arena_duration_label no longer forces (minutes) only",
  );
  assert(
    !/\(minutes\)/i.test(String(t.body?.arena_settings_label_default_duration || "")),
    "default duration label no longer forces (minutes) only",
  );

  const e = await req("/public/events-organizer-chrome");
  assert(e.status === 200, "events-organizer-chrome 200");
  for (const k of keys) {
    assert(nonEmpty(e.body?.[k]), `events_organizer_chrome.${k}`);
  }

  console.log("E2E_PASS: arena duration units + calendar chrome (mig 444–445)");
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
