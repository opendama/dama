-- Admin tournament create/edit: professional title + description placeholders.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'title_placeholder', COALESCE(
    NULLIF(trim(value->>'title_placeholder'), ''),
    'e.g. International Club Championship'
  ),
  'description_placeholder', COALESCE(
    NULLIF(trim(value->>'description_placeholder'), ''),
    'e.g. Swiss system · Open to all players · Online boards'
  )
),
  updated_at = NOW()
WHERE key = 'tournament_chrome';
