-- Result card canvas typography + header wash alpha from DB chrome (no client invent).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'result_card_title_font', COALESCE(NULLIF(trim(value->>'result_card_title_font'), ''), 'bold 28px Georgia, ''Times New Roman'', serif'),
  'result_card_winners_font', COALESCE(NULLIF(trim(value->>'result_card_winners_font'), ''), '600 18px system-ui, sans-serif'),
  'result_card_sponsor_font', COALESCE(NULLIF(trim(value->>'result_card_sponsor_font'), ''), '14px system-ui, sans-serif'),
  'result_card_placement_font', COALESCE(NULLIF(trim(value->>'result_card_placement_font'), ''), 'bold 20px system-ui, sans-serif'),
  'result_card_name_font', COALESCE(NULLIF(trim(value->>'result_card_name_font'), ''), '16px system-ui, sans-serif'),
  'result_card_header_wash_alpha', COALESCE(NULLIF(trim(value->>'result_card_header_wash_alpha'), ''), '0.35')
),
    updated_at = NOW()
WHERE key = 'events_organizer_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'result_card_title_font', COALESCE(NULLIF(trim(value->>'result_card_title_font'), ''), 'bold 28px Georgia, ''Times New Roman'', serif'),
  'result_card_winners_font', COALESCE(NULLIF(trim(value->>'result_card_winners_font'), ''), '600 18px system-ui, sans-serif'),
  'result_card_sponsor_font', COALESCE(NULLIF(trim(value->>'result_card_sponsor_font'), ''), '14px system-ui, sans-serif'),
  'result_card_placement_font', COALESCE(NULLIF(trim(value->>'result_card_placement_font'), ''), 'bold 20px system-ui, sans-serif'),
  'result_card_name_font', COALESCE(NULLIF(trim(value->>'result_card_name_font'), ''), '16px system-ui, sans-serif'),
  'result_card_header_wash_alpha', COALESCE(NULLIF(trim(value->>'result_card_header_wash_alpha'), ''), '0.35')
),
    updated_at = NOW()
WHERE key = 'events_player_chrome';
