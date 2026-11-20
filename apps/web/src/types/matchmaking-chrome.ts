export type MatchmakingChrome = {
  source?: string;
  title?: string;
  blurb?: string;
  find_match_action?: string;
  leave_queue_action?: string;
  players_waiting_title?: string;
  queued_yes?: string;
  queued_no?: string;
  direct_invite_title?: string;
  direct_invite_blurb?: string;
  invite_placeholder?: string;
  send_invite_action?: string;
  accept_action?: string;
  decline_action?: string;
  invite_from_prefix?: string;
  matched_opening?: string;
  rating_label?: string;
  searching_suffix?: string;
  toast_match_found?: string;
  toast_matched_instantly?: string;
  toast_waiting_opponent?: string;
  toast_join_failed?: string;
  toast_invite_sent?: string;
  toast_invite_failed?: string;
  /** DB: cannot challenge yourself (username or id). */
  toast_invite_yourself?: string;
  toast_invite_received?: string;
  toast_invite_accepted?: string;
  toast_invite_declined?: string;
  toast_live_required?: string;
  matchmaking_chrome_unavailable?: string;
  meta_separator?: string;
  join_pending?: string;
  leave_pending?: string;
  send_invite_pending?: string;
  accept_pending?: string;
  decline_pending?: string;
  outgoing_invite_title?: string;
  outgoing_invite_blurb?: string;
  outgoing_keep_waiting_action?: string;
  outgoing_cancel_action?: string;
  outgoing_cancel_pending?: string;
  toast_invite_cancelled?: string;
};

const MATCHMAKING_CHROME_KEYS: (keyof MatchmakingChrome)[] = [
  "source",
  "title",
  "blurb",
  "find_match_action",
  "leave_queue_action",
  "players_waiting_title",
  "queued_yes",
  "queued_no",
  "direct_invite_title",
  "direct_invite_blurb",
  "invite_placeholder",
  "send_invite_action",
  "accept_action",
  "decline_action",
  "invite_from_prefix",
  "matched_opening",
  "rating_label",
  "searching_suffix",
  "toast_match_found",
  "toast_matched_instantly",
  "toast_waiting_opponent",
  "toast_join_failed",
  "toast_invite_sent",
  "toast_invite_failed",
  "toast_invite_yourself",
  "toast_invite_received",
  "toast_invite_accepted",
  "toast_invite_declined",
  "toast_live_required",
  "matchmaking_chrome_unavailable",
  "meta_separator",
  "join_pending",
  "leave_pending",
  "send_invite_pending",
  "accept_pending",
  "decline_pending",
  "outgoing_invite_title",
  "outgoing_invite_blurb",
  "outgoing_keep_waiting_action",
  "outgoing_cancel_action",
  "outgoing_cancel_pending",
  "toast_invite_cancelled",
];

/** Fail closed: every matchmaking chrome string must be present from the database. */
export function isMatchmakingChromeReady(
  chrome: MatchmakingChrome | null | undefined,
): chrome is Required<MatchmakingChrome> {
  if (!chrome) return false;
  return MATCHMAKING_CHROME_KEYS.every((k) => {
    const v = chrome[k];
    return typeof v === "string" && v.trim().length > 0;
  });
}
