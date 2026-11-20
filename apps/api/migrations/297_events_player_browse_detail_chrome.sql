-- Player Events browse + detail chrome (tournaments-parity filters / cards / host).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'page_title', COALESCE(NULLIF(trim(value->>'page_title'), ''), 'Events'),
  'page_blurb', COALESCE(NULLIF(trim(value->>'page_blurb'), ''), 'Browse public cups or join with a code.'),
  'filters_toggle_label', COALESCE(NULLIF(trim(value->>'filters_toggle_label'), ''), 'Filters'),
  'filters_toggle_show_aria', COALESCE(NULLIF(trim(value->>'filters_toggle_show_aria'), ''), 'Show filters'),
  'filters_toggle_hide_aria', COALESCE(NULLIF(trim(value->>'filters_toggle_hide_aria'), ''), 'Hide filters'),
  'search_debounce_ms', COALESCE(NULLIF(trim(value->>'search_debounce_ms'), ''), '250'),
  'hosted_by_label', COALESCE(NULLIF(trim(value->>'hosted_by_label'), ''), 'Hosted by'),
  'carousel_aria', COALESCE(NULLIF(trim(value->>'carousel_aria'), ''), 'Event media'),
  'free_label', COALESCE(NULLIF(trim(value->>'free_label'), ''), 'Free'),
  'players_label', COALESCE(NULLIF(trim(value->>'players_label'), ''), 'players'),
  'entry_label', COALESCE(NULLIF(trim(value->>'entry_label'), ''), 'Entry'),
  'view_action', COALESCE(NULLIF(trim(value->>'view_action'), ''), 'View'),
  'share_action', COALESCE(NULLIF(trim(value->>'share_action'), ''), 'Share'),
  'detail_join_action', COALESCE(NULLIF(trim(value->>'detail_join_action'), ''), 'Join'),
  'join_code_section_title', COALESCE(NULLIF(trim(value->>'join_code_section_title'), ''), 'Have a code?'),
  'join_code_section_blurb', COALESCE(NULLIF(trim(value->>'join_code_section_blurb'), ''), 'Enter a private invite code to open a cup.'),
  'roster_title', COALESCE(NULLIF(trim(value->>'roster_title'), ''), 'Players'),
  'format_label', COALESCE(NULLIF(trim(value->>'format_label'), ''), 'Format'),
  'size_label', COALESCE(NULLIF(trim(value->>'size_label'), ''), 'Size'),
  'empty_web', COALESCE(NULLIF(trim(value->>'empty_web'), ''), COALESCE(NULLIF(trim(value->>'public_list_empty'), ''), 'No public events right now.')),
  'detail_unavailable', COALESCE(NULLIF(trim(value->>'detail_unavailable'), ''), 'Event unavailable')
),
    updated_at = NOW()
WHERE key = 'events_player_chrome';
