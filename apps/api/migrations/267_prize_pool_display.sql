-- Honest prize-pool display: current pot + if-full + optional organizer guarantee hold.
-- Platform kill-switches via feature_flags; per-event organizer toggles on hosted_events.
-- Host fee never enters the pot. Free entry forces display/guarantee off.

-- ---------------------------------------------------------------------------
-- hosted_events columns
-- ---------------------------------------------------------------------------
ALTER TABLE hosted_events
  ADD COLUMN IF NOT EXISTS prize_pool_display_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS prize_pool_guarantee_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS prize_pool_guarantee_amount NUMERIC(12,2) NOT NULL DEFAULT 0
    CHECK (prize_pool_guarantee_amount >= 0),
  ADD COLUMN IF NOT EXISTS prize_pool_frozen_amount NUMERIC(12,2) NULL,
  ADD COLUMN IF NOT EXISTS prize_pool_frozen_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS prize_pool_guarantee_held BOOLEAN NOT NULL DEFAULT FALSE;

-- Free cups must never show prize pool (wash legacy rows).
UPDATE hosted_events
SET prize_pool_display_enabled = FALSE,
    prize_pool_guarantee_enabled = FALSE,
    prize_pool_guarantee_amount = 0,
    updated_at = NOW()
WHERE is_free_entry = TRUE
  AND (
    prize_pool_display_enabled = TRUE
    OR prize_pool_guarantee_enabled = TRUE
    OR prize_pool_guarantee_amount <> 0
  );

-- ---------------------------------------------------------------------------
-- tournaments: organizer/admin display toggle + freeze (entry pot from enrolls)
-- ---------------------------------------------------------------------------
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS prize_pool_display_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS prize_pool_frozen_amount NUMERIC(12,2) NULL,
  ADD COLUMN IF NOT EXISTS prize_pool_frozen_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS max_players INT NULL CHECK (max_players IS NULL OR max_players >= 2);

UPDATE tournaments
SET prize_pool_display_enabled = FALSE,
    updated_at = NOW()
WHERE is_free = TRUE AND prize_pool_display_enabled = TRUE;

-- ---------------------------------------------------------------------------
-- Feature flags (default OFF; admin turns on)
-- ---------------------------------------------------------------------------
INSERT INTO feature_flags (key, enabled, payload) VALUES
  ('prize_pool_display_enabled', FALSE, '{}'::jsonb),
  ('prize_pool_guarantee_enabled', FALSE, '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{toggles}',
  COALESCE(value->'toggles', '[]'::jsonb) || CASE
    WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'toggles', '[]'::jsonb)) t
      WHERE t->>'key' = 'prize_pool_display_enabled'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object(
      'key', 'prize_pool_display_enabled',
      'title', 'Prize pool display',
      'description', 'Allow paid cups to show current pot and if-full prize pool on cards.',
      'kind', 'boolean',
      'state_field', 'prizePoolDisplayEnabled'
    ))
  END
),
updated_at = NOW()
WHERE key = 'feature_flag_catalog';

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{toggles}',
  COALESCE(value->'toggles', '[]'::jsonb) || CASE
    WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'toggles', '[]'::jsonb)) t
      WHERE t->>'key' = 'prize_pool_guarantee_enabled'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object(
      'key', 'prize_pool_guarantee_enabled',
      'title', 'Prize pool guarantee',
      'description', 'Allow organizers to post a guaranteed minimum pot held from their wallet.',
      'kind', 'boolean',
      'state_field', 'prizePoolGuaranteeEnabled'
    ))
  END
),
updated_at = NOW()
WHERE key = 'feature_flag_catalog';

-- Ensure state_field present if toggles already existed without it.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{toggles}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN elem->>'key' = 'prize_pool_display_enabled'
          THEN elem || jsonb_build_object('state_field', 'prizePoolDisplayEnabled')
        WHEN elem->>'key' = 'prize_pool_guarantee_enabled'
          THEN elem || jsonb_build_object('state_field', 'prizePoolGuaranteeEnabled')
        ELSE elem
      END
    ), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'toggles', '[]'::jsonb)) AS elem
  )
),
updated_at = NOW()
WHERE key = 'feature_flag_catalog';

-- ---------------------------------------------------------------------------
-- Wallet ledger kinds + chrome labels (guarantee hold/release/capture)
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{wallet_ledger_kinds}',
  (
    SELECT COALESCE(jsonb_agg(DISTINCT x), '[]'::jsonb)
    FROM (
      SELECT jsonb_array_elements_text(COALESCE(value->'wallet_ledger_kinds', '[]'::jsonb)) AS x
      UNION
      SELECT unnest(ARRAY[
        'prize_pool_guarantee_hold',
        'prize_pool_guarantee_release',
        'prize_pool_guarantee_capture'
      ])
    ) k
  )
),
updated_at = NOW()
WHERE key = 'client_enums';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'list_kind_prize_pool_guarantee_hold', COALESCE(NULLIF(trim(value->>'list_kind_prize_pool_guarantee_hold'), ''), 'Prize pool guarantee hold'),
  'list_kind_prize_pool_guarantee_release', COALESCE(NULLIF(trim(value->>'list_kind_prize_pool_guarantee_release'), ''), 'Prize pool guarantee release'),
  'list_kind_prize_pool_guarantee_capture', COALESCE(NULLIF(trim(value->>'list_kind_prize_pool_guarantee_capture'), ''), 'Prize pool guarantee capture')
),
updated_at = NOW()
WHERE key = 'wallet_chrome';

-- ---------------------------------------------------------------------------
-- Admin chrome
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'prize_pool_display_flag_key', COALESCE(NULLIF(trim(value->>'prize_pool_display_flag_key'), ''), 'prize_pool_display_enabled'),
  'prize_pool_display_flag_label', COALESCE(NULLIF(trim(value->>'prize_pool_display_flag_label'), ''), 'Prize pool on cards'),
  'prize_pool_display_flag_blurb', COALESCE(NULLIF(trim(value->>'prize_pool_display_flag_blurb'), ''), 'When on, organizers of paid cups can show current pot and if-full amounts on event cards. Free cups never show a prize pool.'),
  'prize_pool_guarantee_flag_key', COALESCE(NULLIF(trim(value->>'prize_pool_guarantee_flag_key'), ''), 'prize_pool_guarantee_enabled'),
  'prize_pool_guarantee_flag_label', COALESCE(NULLIF(trim(value->>'prize_pool_guarantee_flag_label'), ''), 'Organizer guarantee'),
  'prize_pool_guarantee_flag_blurb', COALESCE(NULLIF(trim(value->>'prize_pool_guarantee_flag_blurb'), ''), 'When on, organizers can post a guaranteed minimum held from their wallet at create. Requires prize pool display.')
),
updated_at = NOW()
WHERE key = 'events_admin_chrome';

-- ---------------------------------------------------------------------------
-- Organizer chrome (create + manage + cards)
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'prize_pool_display_label', COALESCE(NULLIF(trim(value->>'prize_pool_display_label'), ''), 'Show prize pool on card'),
  'prize_pool_display_blurb', COALESCE(NULLIF(trim(value->>'prize_pool_display_blurb'), ''), 'Shows the current funded pot from entry fees (after platform commission) and how large it would be if the cup fills. Host fee is not included.'),
  'prize_pool_guarantee_label', COALESCE(NULLIF(trim(value->>'prize_pool_guarantee_label'), ''), 'Guaranteed minimum'),
  'prize_pool_guarantee_blurb', COALESCE(NULLIF(trim(value->>'prize_pool_guarantee_blurb'), ''), 'Optional floor held from your wallet at create. Added to the entry-fee pot. Released if you cancel before start.'),
  'prize_pool_guarantee_amount_label', COALESCE(NULLIF(trim(value->>'prize_pool_guarantee_amount_label'), ''), 'Guarantee amount'),
  'prize_pool_now_label', COALESCE(NULLIF(trim(value->>'prize_pool_now_label'), ''), 'Prize pool now'),
  'prize_pool_if_full_label', COALESCE(NULLIF(trim(value->>'prize_pool_if_full_label'), ''), 'If full'),
  'prize_pool_guaranteed_label', COALESCE(NULLIF(trim(value->>'prize_pool_guaranteed_label'), ''), 'Guaranteed'),
  'prize_pool_frozen_blurb', COALESCE(NULLIF(trim(value->>'prize_pool_frozen_blurb'), ''), 'Pot locked when the cup started.'),
  'prize_pool_entry_fees_note', COALESCE(NULLIF(trim(value->>'prize_pool_entry_fees_note'), ''), 'From player entry fees after commission. Host fee is not in the pot.'),
  'insufficient_prize_guarantee', COALESCE(NULLIF(trim(value->>'insufficient_prize_guarantee'), ''), 'Not enough wallet balance to hold the prize guarantee.'),
  'prize_pool_unavailable', COALESCE(NULLIF(trim(value->>'prize_pool_unavailable'), ''), 'Prize pool display is not available.')
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';

-- ---------------------------------------------------------------------------
-- Player chrome (join + public cards)
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'prize_pool_now_label', COALESCE(NULLIF(trim(value->>'prize_pool_now_label'), ''), 'Prize pool now'),
  'prize_pool_if_full_label', COALESCE(NULLIF(trim(value->>'prize_pool_if_full_label'), ''), 'If full'),
  'prize_pool_guaranteed_label', COALESCE(NULLIF(trim(value->>'prize_pool_guaranteed_label'), ''), 'Guaranteed'),
  'prize_pool_frozen_blurb', COALESCE(NULLIF(trim(value->>'prize_pool_frozen_blurb'), ''), 'Pot locked when the cup started.'),
  'prize_pool_entry_fees_note', COALESCE(NULLIF(trim(value->>'prize_pool_entry_fees_note'), ''), 'From player entry fees after commission. Host fee is not in the pot.')
),
updated_at = NOW()
WHERE key = 'events_player_chrome';

-- ---------------------------------------------------------------------------
-- Tournaments player chrome (same labels for paid enroll pots)
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'prize_pool_now_label', COALESCE(NULLIF(trim(value->>'prize_pool_now_label'), ''), 'Prize pool now'),
  'prize_pool_if_full_label', COALESCE(NULLIF(trim(value->>'prize_pool_if_full_label'), ''), 'If full'),
  'prize_pool_guaranteed_label', COALESCE(NULLIF(trim(value->>'prize_pool_guaranteed_label'), ''), 'Guaranteed'),
  'prize_pool_frozen_blurb', COALESCE(NULLIF(trim(value->>'prize_pool_frozen_blurb'), ''), 'Pot locked when enrollment closed.'),
  'prize_pool_display_label', COALESCE(NULLIF(trim(value->>'prize_pool_display_label'), ''), 'Show live prize pool'),
  'prize_pool_entry_fees_note', COALESCE(NULLIF(trim(value->>'prize_pool_entry_fees_note'), ''), 'From player entry fees. Declared prize_pool.total is the guarantee when set.')
),
updated_at = NOW()
WHERE key = 'tournaments_player_chrome';

-- Home live tournament cards (same pot labels; no invent on home surface).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'prize_pool_now_label', COALESCE(NULLIF(trim(value->>'prize_pool_now_label'), ''), 'Prize pool now'),
  'prize_pool_if_full_label', COALESCE(NULLIF(trim(value->>'prize_pool_if_full_label'), ''), 'If full'),
  'prize_pool_guaranteed_label', COALESCE(NULLIF(trim(value->>'prize_pool_guaranteed_label'), ''), 'Guaranteed'),
  'prize_pool_frozen_blurb', COALESCE(NULLIF(trim(value->>'prize_pool_frozen_blurb'), ''), 'Pot locked when enrollment closed.'),
  'meta_separator', COALESCE(NULLIF(value->>'meta_separator', ''), ' · '),
  'amount_currency_separator', COALESCE(NULLIF(value->>'amount_currency_separator', ''), ' ')
),
updated_at = NOW()
WHERE key = 'home_surface_chrome';

-- Tournament console create fields (admin tournament_chrome).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'prize_pool_display_label', COALESCE(NULLIF(trim(value->>'prize_pool_display_label'), ''), 'Show live prize pool'),
  'prize_pool_display_blurb', COALESCE(NULLIF(trim(value->>'prize_pool_display_blurb'), ''), 'Shows current pot from paid enrollments. Prize amount is the guaranteed floor when set. Set max players to show if-full.'),
  'prize_pool_max_players_label', COALESCE(NULLIF(trim(value->>'prize_pool_max_players_label'), ''), 'Max players (for if-full)'),
  'prize_pool_now_label', COALESCE(NULLIF(trim(value->>'prize_pool_now_label'), ''), 'Prize pool now'),
  'prize_pool_if_full_label', COALESCE(NULLIF(trim(value->>'prize_pool_if_full_label'), ''), 'If full'),
  'prize_pool_guaranteed_label', COALESCE(NULLIF(trim(value->>'prize_pool_guaranteed_label'), ''), 'Guaranteed')
),
updated_at = NOW()
WHERE key = 'tournament_chrome';
