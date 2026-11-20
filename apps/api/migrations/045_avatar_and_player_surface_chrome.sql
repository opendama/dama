-- Avatar upload + remaining player-surface chrome (fail closed; no client invent).

INSERT INTO platform_settings (key, value)
VALUES (
  'avatar_chrome',
  '{
    "source": "database",
    "avatar_chrome_unavailable": "Avatar chrome unavailable",
    "page_title": "Avatar",
    "page_blurb": "Upload a profile picture. The picker constrains to a square crop; optimized thumb and full-size versions are returned by the server.",
    "choose_upload_action": "Choose & upload",
    "upload_action": "Upload avatar",
    "uploading_action": "Uploading…",
    "upload_failed": "Upload failed",
    "toast_updated": "Avatar updated",
    "tap_inspect_hint": "Tap avatar to inspect",
    "profile_page_title": "Profile",
    "profile_load_failed": "Failed to load profile"
  }'::jsonb
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = NOW();

UPDATE platform_settings
SET value = value || '{
  "wallet_unavailable": "Wallet unavailable",
  "wallet_load_failed": "Unable to load wallet",
  "country_required_checkout": "Country code required before checkout",
  "invalid_top_up_amount": "Enter a valid top-up amount",
  "checkout_unavailable": "Checkout unavailable",
  "checkout_ready": "Checkout ready",
  "manual_accounts_title": "Manual transfer accounts",
  "banks_loading": "Loading bank details…",
  "banks_empty": "No bank accounts configured. Ask an admin to add transfer details.",
  "bank_name_prefix": "Name:",
  "bank_account_prefix": "Account:",
  "bank_mobile_prefix": "Mobile:",
  "bank_currency_prefix": "Currency:",
  "submit_receipt_title": "Submit transfer receipt",
  "reference_label": "Reference",
  "receipt_image_label": "Receipt image",
  "receipt_uploaded_prefix": "Uploaded:",
  "submit_receipt_action": "Submit receipt",
  "receipt_upload_failed": "Upload failed",
  "receipt_submitted": "Receipt submitted for review",
  "receipt_submit_failed": "Submit failed",
  "checkout_failed": "Checkout failed",
  "location_currency_unresolved": "Location unavailable. Currency cannot be resolved."
}'::jsonb,
updated_at = NOW()
WHERE key = 'wallet_chrome';

UPDATE platform_settings
SET value = value || '{
  "label_draws": "Draws"
}'::jsonb,
updated_at = NOW()
WHERE key = 'profile_inspect_chrome';

UPDATE platform_settings
SET value = value || '{
  "mobile_nav_unavailable": "Navigation unavailable from database."
}'::jsonb,
updated_at = NOW()
WHERE key = 'client_nav';

INSERT INTO platform_settings (key, value)
VALUES (
  'spectate_chrome',
  '{
    "source": "database",
    "spectate_chrome_unavailable": "Spectate chrome unavailable",
    "page_title": "Spectate",
    "page_blurb": "Enter a live game ID. Board sync uses raw WebSockets.",
    "page_blurb_web": "Live board stream. Tap player avatars to inspect profiles.",
    "game_id_required": "Game ID required from a live match",
    "game_id_label": "Game ID",
    "game_id_placeholder": "Game ID",
    "waiting_game_state": "Waiting for live game_state…",
    "enter_game_prompt": "Enter a game ID to spectate.",
    "unable_to_spectate": "Unable to spectate",
    "load_game_failed": "Failed to load game",
    "start_action": "Start spectating",
    "connect_action": "Connect",
    "listening_action": "Listening…",
    "disconnect_action": "Disconnect",
    "connect_title": "Connect",
    "waiting_board": "Waiting for board…",
    "board_after_connect": "Board appears after connect",
    "board_after_connect_web": "Board appears after you connect",
    "connecting_status": "connecting…",
    "disconnected_status": "disconnected",
    "status_draw": "Draw",
    "status_draw_reason_prefix": "Draw (",
    "status_p1_wins": "White wins",
    "status_p2_wins": "Black wins",
    "status_white_to_move": "White to move",
    "status_black_to_move": "Black to move",
    "event_log_title": "Match log",
    "no_events": "No activity yet"
  }'::jsonb
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = NOW();

INSERT INTO platform_settings (key, value)
VALUES (
  'leaderboard_chrome',
  '{
    "source": "database",
    "leaderboard_chrome_unavailable": "Leaderboard chrome unavailable",
    "page_title": "Leaderboard",
    "page_blurb": "Browse top players by rating. Tap a player to open their profile card.",
    "empty": "No ranked players yet.",
    "load_failed": "Leaderboard unavailable",
    "online_label": "Online",
    "offline_label": "Offline",
    "inspect_aria_prefix": "Inspect"
  }'::jsonb
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = NOW();

-- Seed only: never replace an existing row (later soft-fill migs add keys).
INSERT INTO platform_settings (key, value)
VALUES (
  'tournaments_player_chrome',
  '{
    "source": "database",
    "tournaments_player_chrome_unavailable": "Tournaments chrome unavailable",
    "page_title": "Tournaments",
    "page_blurb": "Free tournaments need no wallet balance. Paid tournaments debit your balance on enroll.",
    "empty": "No tournaments yet.",
    "empty_web": "No tournaments published yet.",
    "free_entry_prefix": "Free entry",
    "enroll_action": "Enroll",
    "enrolling_action": "Enrolling…",
    "enroll_failed": "Unable to enroll",
    "joined_free": "Joined free tournament",
    "enrolled_charged_prefix": "Enrolled (charged",
    "enrolled_bare": "Enrolled",
    "load_failed": "Tournaments unavailable"
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO platform_settings (key, value)
VALUES (
  'otp_chrome',
  '{
    "source": "database",
    "otp_chrome_unavailable": "OTP chrome unavailable",
    "verify_title": "Verify OTP",
    "start_failed": "Unable to start OTP",
    "invalid_code": "Invalid code",
    "enter_code_blurb": "Enter the verification code to continue.",
    "enter_code_blurb_web": "Enter the verification code sent to your account to continue.",
    "flags_unavailable": "Security flags unavailable. Retry to continue.",
    "verification_start_failed": "Verification could not start. Retry to continue.",
    "code_label": "Code",
    "code_placeholder": "000000",
    "retry_action": "Retry",
    "retry_otp_action": "Retry OTP",
    "starting_action": "Starting…",
    "verify_action": "Verify",
    "verifying_action": "Verifying…"
  }'::jsonb
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = NOW();
