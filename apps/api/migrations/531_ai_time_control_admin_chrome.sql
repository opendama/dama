-- VS-AI Time picker uses the same match_clock.presets as Challenge / matchmaking.
-- Admin Progression: clarify that default + presets drive AI practice clocks too.
-- Optional blurbs only (not fail-closed required keys).

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{progression}',
  COALESCE(value->'progression', '{}'::jsonb) || jsonb_build_object(
    'initial_seconds_label',
    COALESCE(
      NULLIF(trim(value->'progression'->>'initial_seconds_label'), ''),
      'Default time control'
    ),
    'initial_seconds_blurb',
    COALESCE(
      NULLIF(trim(value->'progression'->>'initial_seconds_blurb'), ''),
      'Default for Play AI and Challenge when the player has not picked another preset. Must be one of the time control presets.'
    ),
    'match_clock_presets_label',
    COALESCE(
      NULLIF(trim(value->'progression'->>'match_clock_presets_label'), ''),
      'Time control presets'
    ),
    'match_clock_presets_blurb',
    COALESCE(
      NULLIF(trim(value->'progression'->>'match_clock_presets_blurb'), ''),
      'Shared by Play AI, Challenge, and matchmaking. Players pick one of these on each surface.'
    )
  ),
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
