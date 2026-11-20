-- Admin tournament create/edit: paid entry fee validation copy (fail-closed chrome).
-- Create stays enabled without forcing the free checkbox; validate fee on submit.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'entry_fee_required', COALESCE(
    NULLIF(trim(value->>'entry_fee_required'), ''),
    'Enter a positive entry fee, or mark the tournament as free.'
  ),
  'title_required', COALESCE(
    NULLIF(trim(value->>'title_required'), ''),
    'Enter a tournament title.'
  )
),
  updated_at = NOW()
WHERE key = 'tournament_chrome';
