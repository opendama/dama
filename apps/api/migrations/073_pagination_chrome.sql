-- Trim-style skip/limit pagination chrome (labels + skip-to page cap).
INSERT INTO platform_settings (key, value, updated_at)
VALUES (
  'pagination_chrome',
  '{
    "max_limit": 100,
    "skip_to_max_pages": 50,
    "prev_action_label": "Prev",
    "next_action_label": "Next",
    "first_action_label": "First",
    "last_action_label": "Last",
    "first_pending_label": "Loading…",
    "prev_pending_label": "Loading…",
    "next_pending_label": "Loading…",
    "last_pending_label": "Loading…",
    "skip_to_label": "Page",
    "skip_to_action_label": "Go",
    "skip_to_pending_label": "Going…",
    "skip_to_invalid": "Invalid page",
    "page_summary_fmt": "Page %d of %d (%d)",
    "pagination_chrome_unavailable": "Pagination chrome unavailable"
  }'::jsonb,
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = platform_settings.value || EXCLUDED.value,
  updated_at = NOW();

-- Play history Live / scrub chrome (smart-menu parity).
UPDATE platform_settings
SET value = value || '{
  "live_label": "Live",
  "history_label": "Moves",
  "status_replay": "Reviewing past move",
  "status_your_turn": "Your turn",
  "status_opponent_turn": "Opponent turn"
}'::jsonb,
updated_at = NOW()
WHERE key = 'play_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{users}',
  COALESCE(value->'users', '{}'::jsonb) || '{
    "confirm_deactivate_title": "Deactivate user",
    "confirm_deactivate_description": "This user will be unable to sign in until reactivated.",
    "confirm_cancel": "Cancel",
    "confirm_deactivate": "Deactivate",
    "confirm_deactivate_pending": "Deactivating…",
    "confirm_activate_title": "Activate user",
    "confirm_activate_description": "This user will be able to sign in again.",
    "confirm_activate": "Activate",
    "confirm_activate_pending": "Activating…"
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{dashboard}',
  COALESCE(value->'dashboard', '{}'::jsonb) || '{
    "kpi_modules_label": "Modules",
    "kpi_signed_in_label": "Signed in"
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
