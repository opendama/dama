-- Mig 389: Hosted-cup QR download filename - Tournament wording (not dama-event-).
-- Players who host see Content-Disposition filename on QR download.
-- Admin may still edit events_catalog.qr_filename_prefix. Idempotent.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{qr_filename_prefix}',
  to_jsonb('dama-tournament-'::text)
),
updated_at = NOW()
WHERE key = 'events_catalog'
  AND COALESCE(value->>'qr_filename_prefix', '') IN (
    'dama-event-',
    'dama-event',
    'event-',
    'events-'
  );
