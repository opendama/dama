-- Match-start VS intro overlay (avatar + name + flag), duration from DB only.

UPDATE platform_settings
SET value = value || '{
  "match_intro_vs_label": "vs",
  "match_intro_duration_ms": "3000",
  "match_intro_aria": "Match starting"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';

UPDATE platform_settings
SET value = value || '{
  "match_intro_vs_label": "vs",
  "match_intro_duration_ms": "3000",
  "match_intro_aria": "Match starting"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_chrome';

UPDATE platform_settings
SET value = value || '{
  "match_intro_vs_label": "vs",
  "match_intro_duration_ms": "3000",
  "match_intro_aria": "Match starting"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'spectate_chrome';
