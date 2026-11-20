-- Mig 382: Admin tournament console helper copy - Tournament wording (not Event sport).
-- Does not change points formulas or points-toast settings keys. Idempotent.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{points_toast_settings_notif_body_blurb}',
  to_jsonb(
    'Use three %s placeholders: points, label, tournament title.'::text
  )
),
updated_at = NOW()
WHERE key = 'tournament_chrome'
  AND COALESCE(value->>'points_toast_settings_notif_body_blurb', '')
    ILIKE '%event title%';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{page_blurb}',
  to_jsonb(
    'Default is paid. Enable Make free game to set is_free=true and zero entry fee. Sponsor prize pools remain optional on free or paid tournaments.'::text
  )
),
updated_at = NOW()
WHERE key = 'tournament_chrome'
  AND COALESCE(value->>'page_blurb', '') ILIKE '%paid events%';
