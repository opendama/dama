-- Heal admin_console_chrome.progression keys required by AdminConsoleChrome
-- fail-closed (match rewards + pause duration unit field). Soft-fill only when
-- missing or blank so admin edits survive re-apply.

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{progression}',
  COALESCE(value->'progression', '{}'::jsonb) || jsonb_build_object(
    'match_rewards_section_title', COALESCE(
      NULLIF(trim(value->'progression'->>'match_rewards_section_title'), ''),
      'Rated match rewards'
    ),
    'match_rewards_blurb', COALESCE(
      NULLIF(trim(value->'progression'->>'match_rewards_blurb'), ''),
      'How much career XP and rating change when a rated human vs human match ends, plus the minimum rating floor and the starting rating for brand-new accounts. Queue games are always rated. Invites can be rated or unrated. VS-AI practice never uses match deltas. Rating deltas may be negative for losses. Profile rating never drops below the floor you set (0 or more). Starting rating must be at least the floor. Changing these does not rewrite existing players except future match results use the new floor.'
    ),
    'win_xp_label', COALESCE(NULLIF(trim(value->'progression'->>'win_xp_label'), ''), 'Win XP'),
    'draw_xp_label', COALESCE(NULLIF(trim(value->'progression'->>'draw_xp_label'), ''), 'Draw XP'),
    'loss_xp_label', COALESCE(NULLIF(trim(value->'progression'->>'loss_xp_label'), ''), 'Loss XP'),
    'win_rating_label', COALESCE(NULLIF(trim(value->'progression'->>'win_rating_label'), ''), 'Win rating'),
    'draw_rating_label', COALESCE(NULLIF(trim(value->'progression'->>'draw_rating_label'), ''), 'Draw rating'),
    'loss_rating_label', COALESCE(NULLIF(trim(value->'progression'->>'loss_rating_label'), ''), 'Loss rating'),
    'starting_rating_label', COALESCE(
      NULLIF(trim(value->'progression'->>'starting_rating_label'), ''),
      'New player starting rating'
    ),
    'rating_floor_label', COALESCE(
      NULLIF(trim(value->'progression'->>'rating_floor_label'), ''),
      'Minimum rating floor'
    ),
    'err_match_rewards_xp', COALESCE(
      NULLIF(trim(value->'progression'->>'err_match_rewards_xp'), ''),
      'Match reward XP values must be whole numbers of 0 or more'
    ),
    'err_match_rewards_rating', COALESCE(
      NULLIF(trim(value->'progression'->>'err_match_rewards_rating'), ''),
      'Match reward rating values must be whole numbers (losses may be negative)'
    ),
    'err_starting_rating', COALESCE(
      NULLIF(trim(value->'progression'->>'err_starting_rating'), ''),
      'Starting rating must be a whole number at or above the minimum rating floor'
    ),
    'err_rating_floor', COALESCE(
      NULLIF(trim(value->'progression'->>'err_rating_floor'), ''),
      'Minimum rating floor must be a whole number of 0 or more'
    ),
    'pause_enabled_label', COALESCE(
      NULLIF(trim(value->'progression'->>'pause_enabled_label'), ''),
      'Pause enabled'
    ),
    'pause_duration_label', COALESCE(
      NULLIF(trim(value->'progression'->>'pause_duration_label'), ''),
      'Pause duration'
    ),
    'pause_duration_blurb', COALESCE(
      NULLIF(trim(value->'progression'->>'pause_duration_blurb'), ''),
      'How long a seated player may freeze the match clock and moves. Enter a number, then choose Seconds or Minutes. The match resumes automatically when this time runs out.'
    ),
    'err_pause_duration', COALESCE(
      NULLIF(trim(value->'progression'->>'err_pause_duration'), ''),
      'Pause duration must be greater than 0 when pause is enabled'
    ),
    'pause_duration_placeholder', COALESCE(
      NULLIF(trim(value->'progression'->>'pause_duration_placeholder'), ''),
      'e.g. 5'
    ),
    'pause_duration_unit_aria', COALESCE(
      NULLIF(trim(value->'progression'->>'pause_duration_unit_aria'), ''),
      'Pause duration unit'
    ),
    'pause_duration_seconds_label', COALESCE(
      NULLIF(trim(value->'progression'->>'pause_duration_seconds_label'), ''),
      'Seconds'
    ),
    'pause_duration_minutes_label', COALESCE(
      NULLIF(trim(value->'progression'->>'pause_duration_minutes_label'), ''),
      'Minutes'
    )
  ),
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
