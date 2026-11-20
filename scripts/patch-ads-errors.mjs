import fs from "node:fs";

const p = "apps/api/internal/rest/ads_handlers.go";
let s = fs.readFileSync(p, "utf8");

const map = [
  ["ad pricing unavailable", "err_pricing_unavailable"],
  ["title required", "err_title_required"],
  ["creative_type required", "err_creative_type_required"],
  ["invalid creative_type", "err_invalid_creative_type"],
  ["campaign defaults unavailable", "err_campaign_defaults_unavailable"],
  ["invalid ends_at", "err_invalid_ends_at"],
  ["status required", "err_status_required"],
  ["invalid status", "err_invalid_status"],
  ["campaign cannot reopen", "err_campaign_cannot_reopen"],
  ["cannot reopen", "err_cannot_reopen"],
  ["video creative type unavailable", "err_video_creative_unavailable"],
  ["servable campaign status unavailable", "err_servable_status_unavailable"],
  ["invalid body", "err_invalid_body"],
  ["placement required", "err_placement_required"],
  ["ad player chrome unavailable", "err_player_chrome_unavailable"],
  ["invalid placement", "err_invalid_placement"],
  ["ad playback unavailable", "err_playback_unavailable"],
  ["ad runtime chrome unavailable", "err_runtime_chrome_unavailable"],
  ["game_elapsed_seconds required", "err_game_elapsed_required"],
  ["creative_url required", "err_creative_url_required"],
  ["unauthorized", "err_unauthorized"],
  ["invalid multipart form", "err_invalid_multipart"],
  ["file required", "err_file_required"],
  ["read failed", "err_read_failed"],
];

for (const [en, key] of map) {
  const needle = `map[string]string{"error": "${en}"}`;
  let idx = s.indexOf(needle, 0);
  while (idx !== -1) {
    // find writeJSON(w, STATUS, needle)
    const start = s.lastIndexOf("writeJSON(", idx);
    if (start < 0 || start < idx - 80) {
      idx = s.indexOf(needle, idx + needle.length);
      continue;
    }
    const statusMatch = s.slice(start).match(/^writeJSON\(w,\s*([^,]+),\s*/);
    if (!statusMatch) {
      idx = s.indexOf(needle, idx + needle.length);
      continue;
    }
    const end = idx + needle.length + 1; // closing )
    const status = statusMatch[1].trim();
    const fullEnd = s.indexOf(")", idx + needle.length);
    const replacement = `writeAdsErr(w, a.Settings, ${status}, "${key}")`;
    s = s.slice(0, start) + replacement + s.slice(fullEnd + 1);
    idx = s.indexOf(needle, start + replacement.length);
  }
}

s = s.replaceAll(
  "writeClientError(w, http.StatusBadRequest, err.Error())",
  'writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_validation_failed")',
);
s = s.replaceAll(
  'writeClientError(w, http.StatusInternalServerError, "unable to create campaign")',
  'writeAdsErr(w, a.Settings, http.StatusInternalServerError, "err_create_failed")',
);
s = s.replaceAll(
  'writeClientError(w, http.StatusNotFound, "campaign not found")',
  'writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")',
);
s = s.replaceAll(
  'writeClientError(w, http.StatusInternalServerError, "unable to roll back unpaid campaign")',
  'writeAdsErr(w, a.Settings, http.StatusInternalServerError, "err_rollback_failed")',
);

fs.writeFileSync(p, s);
const left = [...s.matchAll(/"error":\s*"([a-z][^"]*)"/g)].map((m) => m[1]);
console.log("remaining invent", [...new Set(left)]);
console.log("writeAdsErr count", (s.match(/writeAdsErr\(/g) || []).length);
