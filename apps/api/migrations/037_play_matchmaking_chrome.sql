-- DB-backed play + matchmaking UI chrome (fail closed; no client invent).

INSERT INTO platform_settings (key, value, updated_at)
VALUES (
  'play_chrome',
  '{
    "source": "database",
    "page_title": "Play",
    "choose_mode_hint": "Choose a mode to start.",
    "board_waiting": "Board appears after you start a match",
    "setup_title": "Match setup",
    "pvp_blurb": "Live match board. Moves sync instantly between both players.",
    "practice_blurb": "Practice against the computer. No cash rewards, payouts, or wallet impact.",
    "ai_depth_label": "AI depth",
    "depths_waiting": "Waiting for server depths…",
    "depth_option_prefix": "Depth",
    "play_computer_action": "Play against computer",
    "practice_unavailable": "Computer practice is currently unavailable. You can still join live matches.",
    "new_setup_action": "New setup",
    "toast_computer_unavailable": "Computer practice is currently unavailable",
    "toast_difficulty_unavailable": "Practice difficulty options are unavailable",
    "toast_practice_started": "Practice match started",
    "toast_start_failed": "Failed to start game",
    "toast_load_failed": "Failed to load match",
    "toast_illegal_square": "Illegal square",
    "toast_live_required": "Live board connection required",
    "toast_move_timeout": "Move timed out",
    "toast_move_failed": "Move failed",
    "toast_live_error": "live connection error",
    "status_draw": "Draw",
    "status_draw_reason_prefix": "Draw",
    "status_p1_wins": "Player 1 wins",
    "status_p2_wins": "Player 2 wins",
    "status_multi_capture": "Multi-capture: continue jumping",
    "status_white_to_move": "White to move",
    "status_black_to_move": "Black to move",
    "status_your_turn": "Your turn (white)",
    "status_opponent_turn": "Opponent turn (black)",
    "label_mode": "Mode",
    "label_game": "Game",
    "label_moves": "Moves",
    "label_halfmove": "Halfmove clock",
    "label_rules": "Rules",
    "label_pieces": "Pieces on board",
    "label_white": "white",
    "label_black": "black",
    "play_chrome_unavailable": "Play chrome unavailable"
  }'::jsonb,
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = platform_settings.value || EXCLUDED.value,
  updated_at = NOW();

INSERT INTO platform_settings (key, value, updated_at)
VALUES (
  'matchmaking_chrome',
  '{
    "source": "database",
    "title": "Matchmaking",
    "blurb": "Find an opponent online. Your queue stays private until a match starts, then both players appear on the board.",
    "find_match_action": "Find match",
    "leave_queue_action": "Leave queue",
    "players_waiting_title": "Players waiting",
    "queued_yes": "You are in the queue.",
    "queued_no": "You are not in the queue.",
    "direct_invite_title": "Direct invite",
    "direct_invite_blurb": "Invite by username or user id. Delivery and accept/decline sync over the matchmaking WebSocket.",
    "invite_placeholder": "Opponent username or id",
    "send_invite_action": "Send invite",
    "accept_action": "Accept",
    "decline_action": "Decline",
    "invite_from_prefix": "Invite from",
    "matched_opening": "Matched. Opening board…",
    "rating_label": "Rating",
    "searching_suffix": "searching",
    "toast_match_found": "Match found",
    "toast_matched_instantly": "Matched instantly",
    "toast_waiting_opponent": "Waiting for opponent…",
    "toast_join_failed": "Join failed",
    "toast_invite_sent": "Invite sent",
    "toast_invite_failed": "Invite failed",
    "toast_invite_received": "Invite received",
    "toast_invite_accepted": "Invite accepted",
    "toast_invite_declined": "Invite declined",
    "toast_live_required": "Live connection required",
    "matchmaking_chrome_unavailable": "Matchmaking chrome unavailable"
  }'::jsonb,
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = platform_settings.value || EXCLUDED.value,
  updated_at = NOW();
