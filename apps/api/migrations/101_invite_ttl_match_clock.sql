-- Challenge-link / invite expiry from DB (no Go hardcode).
-- Seed 900s; share copy must stay TTL-agnostic (see mig 105).

UPDATE platform_settings
SET
  value = value || '{"invite_ttl_seconds": 900}'::jsonb,
  updated_at = NOW()
WHERE key = 'match_clock';
