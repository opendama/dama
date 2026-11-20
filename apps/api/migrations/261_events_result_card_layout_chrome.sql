-- Result card canvas layout metrics from DB chrome (no client invent).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'result_card_width', COALESCE(NULLIF(trim(value->>'result_card_width'), ''), '720'),
  'result_card_row_height', COALESCE(NULLIF(trim(value->>'result_card_row_height'), ''), '44'),
  'result_card_header_height', COALESCE(NULLIF(trim(value->>'result_card_header_height'), ''), '168'),
  'result_card_sponsor_height', COALESCE(NULLIF(trim(value->>'result_card_sponsor_height'), ''), '56'),
  'result_card_placements_max', COALESCE(NULLIF(trim(value->>'result_card_placements_max'), ''), '12'),
  'result_card_row_radius', COALESCE(NULLIF(trim(value->>'result_card_row_radius'), ''), '6'),
  'result_card_pad', COALESCE(NULLIF(trim(value->>'result_card_pad'), ''), '36'),
  'result_card_logo_size', COALESCE(NULLIF(trim(value->>'result_card_logo_size'), ''), '72'),
  'result_card_title_y', COALESCE(NULLIF(trim(value->>'result_card_title_y'), ''), '70'),
  'result_card_winners_y', COALESCE(NULLIF(trim(value->>'result_card_winners_y'), ''), '104'),
  'result_card_body_gap', COALESCE(NULLIF(trim(value->>'result_card_body_gap'), ''), '24'),
  'result_card_rows_top_gap', COALESCE(NULLIF(trim(value->>'result_card_rows_top_gap'), ''), '16'),
  'result_card_bottom_pad', COALESCE(NULLIF(trim(value->>'result_card_bottom_pad'), ''), '40'),
  'result_card_row_inset', COALESCE(NULLIF(trim(value->>'result_card_row_inset'), ''), '24'),
  'result_card_row_inner_gap', COALESCE(NULLIF(trim(value->>'result_card_row_inner_gap'), ''), '8'),
  'result_card_placement_x', COALESCE(NULLIF(trim(value->>'result_card_placement_x'), ''), '40'),
  'result_card_name_x', COALESCE(NULLIF(trim(value->>'result_card_name_x'), ''), '88'),
  'result_card_row_text_y', COALESCE(NULLIF(trim(value->>'result_card_row_text_y'), ''), '28'),
  'result_card_sponsor_logo_w', COALESCE(NULLIF(trim(value->>'result_card_sponsor_logo_w'), ''), '120'),
  'result_card_sponsor_logo_h', COALESCE(NULLIF(trim(value->>'result_card_sponsor_logo_h'), ''), '40'),
  'result_card_sponsor_logo_gap', COALESCE(NULLIF(trim(value->>'result_card_sponsor_logo_gap'), ''), '16'),
  'result_card_logo_text_gap', COALESCE(NULLIF(trim(value->>'result_card_logo_text_gap'), ''), '20')
),
    updated_at = NOW()
WHERE key = 'events_organizer_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'result_card_width', COALESCE(NULLIF(trim(value->>'result_card_width'), ''), '720'),
  'result_card_row_height', COALESCE(NULLIF(trim(value->>'result_card_row_height'), ''), '44'),
  'result_card_header_height', COALESCE(NULLIF(trim(value->>'result_card_header_height'), ''), '168'),
  'result_card_sponsor_height', COALESCE(NULLIF(trim(value->>'result_card_sponsor_height'), ''), '56'),
  'result_card_placements_max', COALESCE(NULLIF(trim(value->>'result_card_placements_max'), ''), '12'),
  'result_card_row_radius', COALESCE(NULLIF(trim(value->>'result_card_row_radius'), ''), '6'),
  'result_card_pad', COALESCE(NULLIF(trim(value->>'result_card_pad'), ''), '36'),
  'result_card_logo_size', COALESCE(NULLIF(trim(value->>'result_card_logo_size'), ''), '72'),
  'result_card_title_y', COALESCE(NULLIF(trim(value->>'result_card_title_y'), ''), '70'),
  'result_card_winners_y', COALESCE(NULLIF(trim(value->>'result_card_winners_y'), ''), '104'),
  'result_card_body_gap', COALESCE(NULLIF(trim(value->>'result_card_body_gap'), ''), '24'),
  'result_card_rows_top_gap', COALESCE(NULLIF(trim(value->>'result_card_rows_top_gap'), ''), '16'),
  'result_card_bottom_pad', COALESCE(NULLIF(trim(value->>'result_card_bottom_pad'), ''), '40'),
  'result_card_row_inset', COALESCE(NULLIF(trim(value->>'result_card_row_inset'), ''), '24'),
  'result_card_row_inner_gap', COALESCE(NULLIF(trim(value->>'result_card_row_inner_gap'), ''), '8'),
  'result_card_placement_x', COALESCE(NULLIF(trim(value->>'result_card_placement_x'), ''), '40'),
  'result_card_name_x', COALESCE(NULLIF(trim(value->>'result_card_name_x'), ''), '88'),
  'result_card_row_text_y', COALESCE(NULLIF(trim(value->>'result_card_row_text_y'), ''), '28'),
  'result_card_sponsor_logo_w', COALESCE(NULLIF(trim(value->>'result_card_sponsor_logo_w'), ''), '120'),
  'result_card_sponsor_logo_h', COALESCE(NULLIF(trim(value->>'result_card_sponsor_logo_h'), ''), '40'),
  'result_card_sponsor_logo_gap', COALESCE(NULLIF(trim(value->>'result_card_sponsor_logo_gap'), ''), '16'),
  'result_card_logo_text_gap', COALESCE(NULLIF(trim(value->>'result_card_logo_text_gap'), ''), '20')
),
    updated_at = NOW()
WHERE key = 'events_player_chrome';
