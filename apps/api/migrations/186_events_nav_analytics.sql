-- Add Analytics to Events organizer nav (Ads parity: dashboard / list / analytics).
-- Keep Join route for players; organizer shell mirrors publisher tabs.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{events}',
  (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM (
      SELECT elem
      FROM jsonb_array_elements(COALESCE(value->'events', '[]'::jsonb)) AS elem
      WHERE elem->>'route_key' IS DISTINCT FROM 'events_analytics'
      UNION ALL
      SELECT '{"title": "Analytics", "href": "/events/analytics", "route_key": "events_analytics"}'::jsonb
      WHERE NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(value->'events', '[]'::jsonb)) AS e
        WHERE e->>'route_key' = 'events_analytics'
      )
    ) s
  )
),
updated_at = NOW()
WHERE key = 'client_nav';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{bottom_nav,events}',
  (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM (
      SELECT elem
      FROM jsonb_array_elements(COALESCE(value->'bottom_nav'->'events', '[]'::jsonb)) AS elem
      WHERE elem->>'route_key' IS DISTINCT FROM 'events_analytics'
      UNION ALL
      SELECT '{"title": "Analytics", "href": "/events/analytics", "route_key": "events_analytics"}'::jsonb
      WHERE NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(value->'bottom_nav'->'events', '[]'::jsonb)) AS e
        WHERE e->>'route_key' = 'events_analytics'
      )
    ) s
  )
),
updated_at = NOW()
WHERE key = 'client_nav';

-- Organizer chrome: payments + live board labels (manage dialog / overview).
UPDATE platform_settings
SET value = value || '{
  "payments_tab": "Payments",
  "live_board_tab": "Live board",
  "host_fee_paid_label": "Host fee paid",
  "entry_fees_collected_label": "Entry fees collected",
  "copy_invite_action": "Copy invite text",
  "invite_text_template": "Join my Dama cup! Code: {code} Link: {link}"
}'::jsonb,
updated_at = NOW()
WHERE key = 'events_organizer_chrome';
