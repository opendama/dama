/**
 * One-shot rewrite: English errors in hosted_events_handlers.go -> chrome helpers.
 */
import fs from "node:fs";

const path = "apps/api/internal/rest/hosted_events_handlers.go";
let s = fs.readFileSync(path, "utf8");

const ORG = {
  "events unavailable": "feature_disabled",
  "events catalog unavailable": "err_catalog_unavailable",
  unauthorized: "err_unauthorized",
  "title required": "err_title_required",
  "format_id and size_id required": "err_format_size_required",
  "invalid format_id": "err_invalid_format_id",
  "format not allowed for size": "err_format_not_allowed_for_size",
  "invalid visibility": "err_invalid_visibility",
  "public events disabled": "public_disabled",
  "entry_fee_amount invalid": "err_entry_fee_invalid",
  "entry_fee_amount required": "err_entry_fee_required",
  "event not found": "err_event_not_found",
  "event not editable": "err_event_not_editable",
  "invalid JSON body": "err_invalid_json",
  "no fields to update": "err_no_fields",
  "events organizer chrome unavailable": "events_organizer_chrome_unavailable",
  "invalid multipart form": "err_invalid_multipart",
  "file required": "err_file_required",
  "read failed": "err_read_failed",
  forbidden: "not_organizer",
  "entry not found": "err_entry_not_found",
  "auto approve only": "err_auto_approve_only",
  "unable to refund entry fee": "err_refund_failed",
  "unable to refund entry fees": "err_refund_failed",
  "cannot cancel": "err_cannot_close",
  "cannot reopen": "cannot_reopen_blurb",
  "cannot start": "err_cannot_start",
  "format not startable": "err_format_not_startable",
  "format unavailable": "format_unavailable",
  "not enough players": "not_enough_players",
  "bracket exists": "err_bracket_exists",
  "event not live": "err_event_not_live",
  "match not found": "err_match_not_found",
  "match not ready": "err_match_not_ready",
  "players missing": "err_players_missing",
  "games unavailable": "err_games_unavailable",
  "board rules unavailable": "err_board_rules_unavailable",
  "unable to initialize board": "err_board_init_failed",
  "share url unavailable": "err_share_url_unavailable",
  "qr unavailable": "qr_unavailable",
  "unable to create event": "err_create_failed",
  "unable to load dashboard": "err_dashboard_failed",
  "unable to load analytics": "err_analytics_failed",
  "unable to update event": "err_update_failed",
  "unable to load events": "err_list_failed",
  "media upload unavailable": "err_media_unavailable",
  "unable to upload media": "err_media_upload_failed",
  "unable to save logo": "err_logo_save_failed",
  "unable to save sponsor logo": "err_sponsor_save_failed",
  "unable to load entries": "err_entries_failed",
  "unable to cancel event": "err_close_failed",
  "unable to start event": "err_start_failed",
  "unable to load bracket": "err_bracket_failed",
  "unable to start game": "err_start_game_failed",
  "unable to attach game": "err_attach_game_failed",
  "unable to generate qr": "err_qr_failed",
};

const PLAYER = {
  "code required": "err_code_required",
  "event not found": "err_event_not_found",
  "event not joinable": "event_not_joinable",
  "event full": "event_full",
  "already joined": "already_joined",
  "entry fee unavailable": "err_entry_fee_unavailable",
  "unable to join event": "events_player_chrome_unavailable",
  "public events disabled": "public_disabled",
  forbidden: "err_forbidden",
  unauthorized: "err_unauthorized",
  "invalid JSON body": "err_invalid_json",
  "invalid reason_code": "err_invalid_reason_code",
  "report already open": "err_report_already_open",
  "unable to submit report": "err_report_submit_failed",
  "share url unavailable": "err_share_url_unavailable",
  "qr unavailable": "qr_unavailable",
  "events unavailable": "feature_disabled",
  "events player chrome unavailable": "events_player_chrome_unavailable",
};

const ADMIN = {
  "report not found": "err_report_not_found",
  "event not found": "err_event_not_found",
  "unable to load events": "err_list_failed",
  "unable to load reports": "err_reports_failed",
  "unable to dismiss report": "err_dismiss_failed",
  "unable to deactivate event": "err_deactivate_failed",
  "unable to update report": "err_report_update_failed",
  "unable to refund entry fees": "err_refund_failed",
  unauthorized: "err_unauthorized",
  "events catalog unavailable": "err_catalog_unavailable",
  "events unavailable": "feature_disabled",
  "invalid JSON body": "err_invalid_json",
};

function pickWriter(ctx) {
  const lower = ctx.toLowerCase();
  if (
    /func \(a \*hostedeventsapi\) (listreports|dismissreport|deactivate|admin|consol)/i.test(ctx) ||
    lower.includes("listreports") ||
    lower.includes("dismissreport") ||
    lower.includes("deactivatefromreport") ||
    lower.includes("adminlist") ||
    lower.includes("writeeventsadmin")
  ) {
    return "admin";
  }
  // Walk back to find enclosing function name
  const fn = ctx.match(/func \(a \*HostedEventsAPI\) (\w+)/g);
  const lastFn = fn?.length ? fn[fn.length - 1] : "";
  const name = (lastFn.match(/\) (\w+)/) || [])[1] || "";
  const n = name.toLowerCase();
  if (n.includes("report") || n.includes("admin") || n === "dismiss" || n.includes("deactivate")) {
    return "admin";
  }
  if (
    n.includes("join") ||
    n.includes("public") ||
    n.includes("share") ||
    n.includes("getbycode") ||
    n === "get" ||
    n.includes("player") ||
    (n.includes("report") && n.includes("create"))
  ) {
    return "player";
  }
  if (
    lower.includes("join") ||
    lower.includes("getbyjoincode") ||
    lower.includes("event_not_joinable") ||
    lower.includes("already_joined")
  ) {
    return "player";
  }
  return "org";
}

function writerCall(kind, statusExpr, key) {
  if (kind === "player") {
    return `writeEventsPlayerErr(w, a.Settings, r.Context(), ${statusExpr}, "${key}")`;
  }
  if (kind === "admin") {
    return `writeEventsAdminErr(w, a.Settings, r.Context(), ${statusExpr}, "${key}")`;
  }
  return `writeEventsOrgErr(w, a.Settings, r.Context(), ${statusExpr}, "${key}")`;
}

function resolve(kind, msg) {
  if (kind === "player" && PLAYER[msg]) return { kind, key: PLAYER[msg] };
  if (kind === "admin" && ADMIN[msg]) return { kind, key: ADMIN[msg] };
  if (ORG[msg])
    return {
      kind:
        kind === "player" && PLAYER[msg]
          ? "player"
          : kind === "admin" && ADMIN[msg]
            ? "admin"
            : "org",
      key: ORG[msg],
    };
  if (PLAYER[msg]) return { kind: "player", key: PLAYER[msg] };
  if (ADMIN[msg]) return { kind: "admin", key: ADMIN[msg] };
  return null;
}

function rewritePattern(re) {
  const out = [];
  let last = 0;
  let m;
  const unmapped = [];
  m = re.exec(s);
  while (m) {
    out.push(s.slice(last, m.index));
    const status = m[1].trim();
    const msg = m[2];
    const ctx = s.slice(Math.max(0, m.index - 800), m.index);
    let kind = pickWriter(ctx);
    // Force player keys
    if (
      msg === "event full" ||
      msg === "already joined" ||
      msg === "event not joinable" ||
      msg === "code required" ||
      msg === "entry fee unavailable" ||
      msg === "unable to join event"
    ) {
      kind = "player";
    }
    if (
      msg === "report not found" ||
      msg === "unable to load reports" ||
      msg === "unable to dismiss report" ||
      msg === "unable to deactivate event" ||
      msg === "unable to update report"
    ) {
      kind = "admin";
    }
    const resolved = resolve(kind, msg);
    if (!resolved) {
      unmapped.push(msg);
      out.push(m[0]);
    } else {
      // Prefer player map when message is player-specific even if ORG had same English
      if (
        PLAYER[msg] &&
        (msg === "event full" ||
          msg === "already joined" ||
          msg === "event not joinable" ||
          msg === "code required" ||
          msg === "entry fee unavailable" ||
          msg === "unable to join event" ||
          msg === "unable to submit report" ||
          msg === "report already open" ||
          msg === "invalid reason_code")
      ) {
        out.push(writerCall("player", status, PLAYER[msg]));
      } else if (ADMIN[msg] && kind === "admin") {
        out.push(writerCall("admin", status, ADMIN[msg]));
      } else {
        out.push(writerCall(resolved.kind === "org" ? "org" : resolved.kind, status, resolved.key));
      }
    }
    last = m.index + m[0].length;
    m = re.exec(s);
  }
  out.push(s.slice(last));
  s = out.join("");
  return unmapped;
}

const u1 = rewritePattern(
  /writeJSON\(w,\s*([^,]+),\s*map\[string\]string\{\s*"error":\s*"([^"]+)"\s*\}\)/g,
);
const u2 = rewritePattern(/writeClientError\(w,\s*([^,]+),\s*"([^"]+)"\)/g);

fs.writeFileSync(path, s);

const leftJson = [...s.matchAll(/map\[string\]string\{\s*"error":\s*"([^"]+)"\s*\}/g)].map(
  (x) => x[1],
);
const leftClient = [...s.matchAll(/writeClientError\(w,\s*[^,]+,\s*"([^"]+)"\)/g)].map((x) => x[1]);
console.log("unmapped_pass1", [...new Set(u1)]);
console.log("unmapped_pass2", [...new Set(u2)]);
console.log("remaining_json", [...new Set(leftJson)]);
console.log("remaining_client", [...new Set(leftClient)]);
