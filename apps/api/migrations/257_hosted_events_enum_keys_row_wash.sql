-- Dedicated report / visibility enum keys + result card row wash (no client invent).
-- Idempotent merges only.

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'hosted_event_report_open_status', COALESCE(NULLIF(trim(value->>'hosted_event_report_open_status'), ''), 'open'),
  'hosted_event_report_dismissed_status', COALESCE(NULLIF(trim(value->>'hosted_event_report_dismissed_status'), ''), 'dismissed'),
  'hosted_event_report_deactivated_status', COALESCE(NULLIF(trim(value->>'hosted_event_report_deactivated_status'), ''), 'deactivated'),
  'hosted_event_public_visibility', COALESCE(NULLIF(trim(value->>'hosted_event_public_visibility'), ''), 'public'),
  'hosted_event_private_visibility', COALESCE(NULLIF(trim(value->>'hosted_event_private_visibility'), ''), 'private')
),
    updated_at = NOW()
WHERE key = 'client_enums';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'result_card_row_wash_color', COALESCE(NULLIF(trim(value->>'result_card_row_wash_color'), ''), '#FFFFFF0F'),
  'group_label_template', COALESCE(NULLIF(trim(value->>'group_label_template'), ''), 'Group {n}'),
  'swiss_round_label_template', COALESCE(NULLIF(trim(value->>'swiss_round_label_template'), ''), 'Round {n}'),
  'phase_group_label', COALESCE(NULLIF(trim(value->>'phase_group_label'), ''), 'Group stage'),
  'phase_knockout_label', COALESCE(NULLIF(trim(value->>'phase_knockout_label'), ''), 'Knockout')
),
    updated_at = NOW()
WHERE key = 'events_organizer_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'result_card_row_wash_color', COALESCE(NULLIF(trim(value->>'result_card_row_wash_color'), ''), '#FFFFFF0F'),
  'group_label_template', COALESCE(NULLIF(trim(value->>'group_label_template'), ''), 'Group {n}'),
  'swiss_round_label_template', COALESCE(NULLIF(trim(value->>'swiss_round_label_template'), ''), 'Round {n}'),
  'phase_group_label', COALESCE(NULLIF(trim(value->>'phase_group_label'), ''), 'Group stage'),
  'phase_knockout_label', COALESCE(NULLIF(trim(value->>'phase_knockout_label'), ''), 'Knockout')
),
    updated_at = NOW()
WHERE key = 'events_player_chrome';
