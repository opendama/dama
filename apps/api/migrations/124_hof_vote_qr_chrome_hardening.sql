-- Harden Hall of Fame / vote / live-games chrome: remove client invent for unranked,
-- vote meta separator, empty viewers count, and play-rail game-id truncate (parity with play_chrome).

UPDATE platform_settings
SET value = value || '{
  "unranked_label": "-",
  "podium_second_crown": "2",
  "podium_third_crown": "3"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'leaderboard_chrome';

UPDATE platform_settings
SET value = value || '{
  "vote_meta_separator": " · ",
  "viewers_overflow_prefix": "+"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'spectate_chrome';

UPDATE platform_settings
SET value = value || '{
  "id_truncate_chars": "8",
  "id_truncate_suffix": "…",
  "viewers_empty_count": "0"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';
