import fs from "node:fs";

const p = "apps/api/internal/rest/ads_handlers.go";
let s = fs.readFileSync(p, "utf8");

const map = [
  ["unable to load campaigns", "err_list_failed", "InternalServerError"],
  ["invalid status", "err_invalid_status", "BadRequest"],
  ["unable to queue upload", "err_video_queue_failed", "BadRequest"],
  ["unable to upload video", "err_video_upload_failed", "BadRequest"],
  ["unable to serve ads", "err_serve_failed", "InternalServerError"],
  ["unable to load scheduled campaigns", "err_schedule_list_failed", "InternalServerError"],
  ["unable to read impression caps", "err_caps_failed", "InternalServerError"],
  ["unable to record click", "err_click_failed", "BadRequest"],
  ["media upload unavailable", "err_media_unavailable", "ServiceUnavailable"],
  ["unable to upload media", "err_media_upload_failed", "BadRequest"],
  ["unable to record completion", "err_completion_failed", "BadRequest"],
];

for (const [en, key, status] of map) {
  const from = `writeClientError(w, http.Status${status}, "${en}")`;
  const to = `writeAdsErr(w, a.Settings, http.Status${status}, "${key}")`;
  s = s.replaceAll(from, to);
}

fs.writeFileSync(p, s);
const left = [...s.matchAll(/writeClientError\(w,\s*([^,]+),\s*"([^"]+)"/g)].map(
  (m) => `${m[1]}|${m[2]}`,
);
console.log("remaining writeClientError invent", left);
