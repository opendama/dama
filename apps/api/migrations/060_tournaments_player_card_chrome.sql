-- Tournament list card labels (gallery / prize / players) for player web + mobile.
-- Fail closed: clients require these keys before rendering card metadata.

UPDATE platform_settings
SET value = value || '{
  "players_label": "players",
  "prize_label": "Prize",
  "entry_label": "Entry",
  "free_label": "Free",
  "carousel_aria": "Tournament gallery"
}'::jsonb,
updated_at = NOW()
WHERE key = 'tournaments_player_chrome';
