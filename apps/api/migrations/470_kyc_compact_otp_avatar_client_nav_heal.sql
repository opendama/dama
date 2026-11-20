-- Heal local/live: reclaim dropped KYC column slots (069-071 ADD then 293 DROP every boot),
-- keep simplified KYC shape from 293, restore otp/avatar API chrome + client_nav bottom_nav.events.

DO $$
DECLARE
  dropped_n int;
BEGIN
  SELECT count(*) INTO dropped_n
  FROM pg_attribute
  WHERE attrelid = 'public.kyc_document_submissions'::regclass
    AND attnum > 0
    AND attisdropped;

  IF dropped_n < 50 THEN
    -- Still ensure simplified schema (no printed-ID metadata columns).
    ALTER TABLE kyc_document_submissions DROP COLUMN IF EXISTS document_number;
    ALTER TABLE kyc_document_submissions DROP COLUMN IF EXISTS document_issued_on;
    ALTER TABLE kyc_document_submissions DROP COLUMN IF EXISTS document_expires_on;
    ALTER TABLE kyc_document_submissions DROP COLUMN IF EXISTS document_country_code;
    RETURN;
  END IF;

  CREATE TABLE kyc_document_submissions__compact (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    legal_name TEXT NOT NULL,
    id_front_url TEXT NOT NULL,
    id_back_url TEXT NOT NULL DEFAULT '',
    selfie_url TEXT NOT NULL,
    status TEXT NOT NULL,
    review_note TEXT NOT NULL DEFAULT '',
    reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  INSERT INTO kyc_document_submissions__compact (
    id, user_id, document_type, legal_name, id_front_url, id_back_url, selfie_url,
    status, review_note, reviewer_id, reviewed_at, created_at, updated_at
  )
  SELECT
    id, user_id, document_type, legal_name, id_front_url, id_back_url, selfie_url,
    status, review_note, reviewer_id, reviewed_at, created_at, updated_at
  FROM kyc_document_submissions;

  DROP TABLE kyc_document_submissions;
  ALTER TABLE kyc_document_submissions__compact RENAME TO kyc_document_submissions;

  CREATE INDEX IF NOT EXISTS idx_kyc_docs_user_created
    ON kyc_document_submissions (user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_kyc_docs_status
    ON kyc_document_submissions (status, created_at DESC);
END $$;

-- OTP API error keys required by handlers / ReloadOTPChrome.
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "err_unauthorized": "Sign in required",
  "err_not_required": "Verification is not required",
  "err_challenge_required": "Challenge id and code are required",
  "err_verification_required": "Verification required",
  "err_verification_unavailable": "Verification unavailable"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'otp_chrome';

-- Avatar API error keys + change-photo aria required by AvatarChrome.
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "change_photo_aria": "Change profile photo",
  "err_unauthorized": "Sign in required",
  "err_moderation_unavailable": "Avatar moderation config unavailable",
  "err_invalid_multipart": "Invalid multipart form",
  "err_file_required": "File required",
  "err_read_failed": "Read failed",
  "err_process_failed": "Unable to process avatar",
  "err_media_upload_unavailable": "Media upload unavailable",
  "err_invalid_image": "Invalid image file",
  "err_save_failed": "Unable to save avatar",
  "err_serve_forbidden": "Forbidden"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'avatar_chrome';

-- client_nav bottom_nav.events empty breaks ListClientNav (player/mobile/ads ok, events=0).
UPDATE platform_settings
SET value = jsonb_set(
  CASE
    WHEN value ? 'bottom_nav' THEN value
    ELSE value || jsonb_build_object('bottom_nav', '{}'::jsonb)
  END,
  '{bottom_nav,events}',
  (
    SELECT COALESCE(jsonb_agg(elem ORDER BY ord), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'events', '[]'::jsonb))
      WITH ORDINALITY AS t(elem, ord)
    WHERE COALESCE(elem->>'route_key', '') NOT IN ('events_public', 'events')
      AND COALESCE(elem->>'href', '') NOT LIKE '/events/public%'
      AND COALESCE(elem->>'href', '') <> ''
      AND COALESCE(elem->>'title', '') <> ''
  )
),
    updated_at = NOW()
WHERE key = 'client_nav'
  AND jsonb_typeof(COALESCE(value->'events', 'null'::jsonb)) = 'array'
  AND jsonb_array_length(COALESCE(value->'events', '[]'::jsonb)) > 0
  AND (
    NOT (value ? 'bottom_nav')
    OR NOT (value->'bottom_nav' ? 'events')
    OR jsonb_typeof(value->'bottom_nav'->'events') <> 'array'
    OR jsonb_array_length(COALESCE(value->'bottom_nav'->'events', '[]'::jsonb)) = 0
  );
