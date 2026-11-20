-- Arena force-finish chrome for organizer + admin console (DB-driven labels only).
UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'arena_finish_action', COALESCE(NULLIF(trim(value->>'arena_finish_action'), ''), 'Finish arena'),
    'arena_finish_pending', COALESCE(NULLIF(trim(value->>'arena_finish_pending'), ''), 'Finishing…'),
    'toast_arena_finished', COALESCE(NULLIF(trim(value->>'toast_arena_finished'), ''), 'Arena finished'),
    'toast_arena_finish_failed', COALESCE(NULLIF(trim(value->>'toast_arena_finish_failed'), ''), 'Could not finish arena'),
    'payout_default_format_knockout_label', COALESCE(NULLIF(trim(value->>'payout_default_format_knockout_label'), ''), 'Knockout'),
    'payout_default_format_round_robin_label', COALESCE(NULLIF(trim(value->>'payout_default_format_round_robin_label'), ''), 'Round robin'),
    'payout_default_format_swiss_label', COALESCE(NULLIF(trim(value->>'payout_default_format_swiss_label'), ''), 'Swiss'),
    'payout_default_format_groups_knockout_label', COALESCE(NULLIF(trim(value->>'payout_default_format_groups_knockout_label'), ''), 'Groups + KO'),
    'payout_default_format_arena_label', COALESCE(NULLIF(trim(value->>'payout_default_format_arena_label'), ''), 'Arena'),
    'projected_payout_section_label', COALESCE(NULLIF(trim(value->>'projected_payout_section_label'), ''), 'Projected payout'),
    'projected_payout_blurb', COALESCE(NULLIF(trim(value->>'projected_payout_blurb'), ''), 'Estimate from current pot and scoreboard. Final payout uses the frozen pot at finish.')
  ),
  updated_at = NOW()
WHERE key = 'tournament_chrome';

UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'arena_finish_action', COALESCE(NULLIF(trim(value->>'arena_finish_action'), ''), 'Finish arena'),
    'arena_finish_pending', COALESCE(NULLIF(trim(value->>'arena_finish_pending'), ''), 'Finishing…'),
    'toast_arena_finished', COALESCE(NULLIF(trim(value->>'toast_arena_finished'), ''), 'Arena finished'),
    'toast_arena_finish_failed', COALESCE(NULLIF(trim(value->>'toast_arena_finish_failed'), ''), 'Could not finish arena')
  ),
  updated_at = NOW()
WHERE key = 'events_organizer_chrome';
