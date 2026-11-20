/**
 * Master runner for platform tournament competitive-loop E2Es.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-platform-tournament-suite.mjs
 *
 * Optional:
 *   $env:DAMA_E2E_WAIT_AUTO_SETTLE='1'  # settle uses background worker (no console click)
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scripts = [
  "e2e-platform-tournament-standings-pts-check.mjs",
  "e2e-platform-tournament-dual-ready-check.mjs",
  "e2e-platform-tournament-rematch-check.mjs",
  "e2e-platform-tournament-ready-timeout-check.mjs",
  "e2e-platform-tournaments-formats-check.mjs",
  "e2e-platform-tournament-arena-check.mjs",
  "e2e-competition-arena-ops-check.mjs",
  "e2e-competition-arena-notifications-check.mjs",
  "e2e-competition-arena-points-toast-check.mjs",
  "e2e-competition-points-toast-check.mjs",
  "e2e-competition-ko-points-toast-check.mjs",
  "e2e-hosted-event-ko-points-toast-check.mjs",
  "e2e-competition-points-toast-settings-check.mjs",
  "e2e-competition-payout-guards-check.mjs",
  "e2e-competition-payout-create-defaults-check.mjs",
  "e2e-platform-tournament-payout-percent-check.mjs",
  "e2e-platform-tournament-payout-score-share-check.mjs",
  "e2e-platform-tournament-arena-dual-purse-check.mjs",
  "e2e-platform-tournament-play-settle-check.mjs",
  "e2e-platform-tournament-archive-refund-check.mjs",
  "e2e-platform-tournament-report-check.mjs",
  "e2e-competition-checkin-seed-check.mjs",
  "e2e-hosted-events-dual-ready-check.mjs",
  "e2e-hosted-event-ready-timeout-check.mjs",
  "e2e-hosted-event-play-settle-check.mjs",
  "e2e-hosted-event-report-check.mjs",
  "e2e-hosted-event-arena-check.mjs",
  "e2e-hosted-event-arena-points-toast-check.mjs",
  "e2e-hosted-event-arena-payout-percent-check.mjs",
  "e2e-hosted-event-arena-payout-score-share-check.mjs",
  "e2e-hosted-event-arena-dual-purse-check.mjs",
  "e2e-hosted-event-points-toast-check.mjs",
  "e2e-platform-tournament-ko-places-percent-check.mjs",
  "e2e-platform-tournament-ko-score-share-check.mjs",
  "e2e-platform-tournament-ko-dual-purse-check.mjs",
  "e2e-platform-tournament-rr-places-percent-check.mjs",
  "e2e-platform-tournament-swiss-places-percent-check.mjs",
  "e2e-platform-tournament-groups-places-percent-check.mjs",
  "e2e-platform-tournament-rr-score-share-check.mjs",
  "e2e-platform-tournament-swiss-score-share-check.mjs",
  "e2e-platform-tournament-groups-score-share-check.mjs",
  "e2e-platform-tournament-rr-dual-purse-check.mjs",
  "e2e-platform-tournament-swiss-dual-purse-check.mjs",
  "e2e-platform-tournament-groups-dual-purse-check.mjs",
  "e2e-hosted-event-ko-places-percent-check.mjs",
  "e2e-hosted-event-ko-score-share-check.mjs",
  "e2e-hosted-event-ko-dual-purse-check.mjs",
  "e2e-hosted-event-rr-places-percent-check.mjs",
  "e2e-hosted-event-swiss-places-percent-check.mjs",
  "e2e-hosted-event-groups-places-percent-check.mjs",
  "e2e-hosted-event-rr-score-share-check.mjs",
  "e2e-hosted-event-swiss-score-share-check.mjs",
  "e2e-hosted-event-groups-score-share-check.mjs",
  "e2e-hosted-event-rr-dual-purse-check.mjs",
  "e2e-hosted-event-swiss-dual-purse-check.mjs",
  "e2e-hosted-event-groups-dual-purse-check.mjs",
  "e2e-competition-arena-pairing-leave-check.mjs",
  "e2e-platform-tournament-arena-timer-check.mjs",
];

function sleep(ms) {
  spawnSync(process.execPath, ["-e", `setTimeout(()=>{},${ms})`], {
    stdio: "ignore",
  });
}

let failed = 0;
for (const name of scripts) {
  console.log(`\n======== ${name} ========`);
  const r = spawnSync(process.execPath, [path.join(root, "scripts", name)], {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    shell: false,
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    failed = r.status || 1;
    console.error(`FAIL suite stopped at ${name} exit=${failed}`);
    process.exit(failed);
  }
  sleep(5000);
}
console.log("\nPLATFORM TOURNAMENT SUITE_OK");
