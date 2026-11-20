-- Admin tournament create chrome + mobile play lobby keys (fail closed).

INSERT INTO platform_settings (key, value, updated_at)
VALUES (
  'tournament_chrome',
  '{
    "source": "database",
    "page_title": "Tournaments",
    "page_blurb": "Default is paid. Enable Make free game to set is_free=true and zero entry fee. Sponsor prize pools remain optional on free or paid events.",
    "title_label": "Title",
    "description_label": "Description",
    "make_free_label": "Make free game / zero entry fee",
    "entry_currency_label": "Entry fee currency",
    "entry_amount_label": "Entry fee amount",
    "prize_amount_label": "Prize pool amount (optional sponsor pool)",
    "prize_currency_label": "Prize pool currency",
    "prize_placeholder": "0",
    "create_action": "Create tournament",
    "existing_title": "Existing",
    "is_free_prefix": "is_free=",
    "prize_prefix": "prize",
    "toast_created": "Tournament created",
    "toast_create_failed": "Create failed",
    "toast_status_updated": "Tournament status updated",
    "toast_status_failed": "Status update failed",
    "tournament_chrome_unavailable": "Tournament chrome unavailable"
  }'::jsonb,
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = platform_settings.value || EXCLUDED.value,
  updated_at = NOW();

UPDATE platform_settings
SET value = value || '{
  "lobby_title": "Play lobby",
  "lobby_modes_blurb": "Available play modes for your region.",
  "find_1v1_action": "Find 1v1 match",
  "practice_depth_label": "Practice depth (from server)",
  "practice_unavailable_short": "Computer practice is currently unavailable."
}'::jsonb,
updated_at = NOW()
WHERE key = 'play_chrome';
