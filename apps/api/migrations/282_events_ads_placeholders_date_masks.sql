-- Event create placeholders (global/business-safe title), entry fee placeholder,
-- brand color hint, date/datetime mask placeholders, ensure ads create-fee pricing.

-- Hosted event organizer create chrome
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'create_title', COALESCE(NULLIF(trim(value->>'create_title'), ''), 'Create hosted event'),
  'create_blurb', COALESCE(
    NULLIF(trim(value->>'create_blurb'), ''),
    'Pay the host fee to publish. Join code, link, and QR unlock after payment.'
  ),
  'title_label', COALESCE(NULLIF(trim(value->>'title_label'), ''), 'Event name'),
  -- Cafe-local name retired: international / direct-business organizers.
  'title_placeholder', 'Friday club cup',
  'format_label', COALESCE(NULLIF(trim(value->>'format_label'), ''), 'Format'),
  'size_label', COALESCE(NULLIF(trim(value->>'size_label'), ''), 'Host size'),
  'brand_color_label', COALESCE(NULLIF(trim(value->>'brand_color_label'), ''), 'Brand color'),
  'brand_color_placeholder', COALESCE(
    NULLIF(trim(value->>'brand_color_placeholder'), ''),
    '#C9A227'
  ),
  'visibility_label', COALESCE(NULLIF(trim(value->>'visibility_label'), ''), 'Visibility'),
  'visibility_private_label', COALESCE(
    NULLIF(trim(value->>'visibility_private_label'), ''),
    'Private'
  ),
  'visibility_private_blurb', COALESCE(
    NULLIF(trim(value->>'visibility_private_blurb'), ''),
    'Join only with code, link, or QR.'
  ),
  'force_auto_approve_note', COALESCE(
    NULLIF(trim(value->>'force_auto_approve_note'), ''),
    'Joiners are approved automatically.'
  ),
  'entry_free_label', COALESCE(NULLIF(trim(value->>'entry_free_label'), ''), 'Free for players'),
  'entry_fee_label', COALESCE(NULLIF(trim(value->>'entry_fee_label'), ''), 'Player entry fee'),
  'entry_fee_placeholder', COALESCE(
    NULLIF(trim(value->>'entry_fee_placeholder'), ''),
    '0.00'
  )
),
    updated_at = NOW()
WHERE key = 'events_organizer_chrome';

-- Standard calendar masks (shadcn-style empty state): mm/dd/yyyy (+ time for ends_at)
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'doc_kyc_issued_placeholder', 'mm/dd/yyyy',
  'doc_kyc_expires_placeholder', 'mm/dd/yyyy',
  'age_gate_dob_placeholder', 'mm/dd/yyyy'
),
    updated_at = NOW()
WHERE key = 'cash_rmg_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'ph_ends_at', 'mm/dd/yyyy --:-- --'
),
    updated_at = NOW()
WHERE key = 'ad_runtime_chrome';

-- Ads campaign create fee (wallet debit); keep existing amounts when already set.
INSERT INTO platform_settings (key, value)
VALUES (
  'ad_pricing',
  '{"impression_unit_cost": 0.01, "campaign_create_fee_amount": 25, "campaign_create_fee_currency": "ETB"}'::jsonb
)
ON CONFLICT (key) DO UPDATE
SET value = COALESCE(platform_settings.value, '{}'::jsonb) || jsonb_build_object(
  'impression_unit_cost', COALESCE(
    (platform_settings.value->>'impression_unit_cost')::numeric,
    0.01
  ),
  'campaign_create_fee_amount', COALESCE(
    (platform_settings.value->>'campaign_create_fee_amount')::numeric,
    25
  ),
  'campaign_create_fee_currency', COALESCE(
    NULLIF(trim(platform_settings.value->>'campaign_create_fee_currency'), ''),
    'ETB'
  )
),
    updated_at = NOW();

-- Ads create-fee chrome copy (labels already present; re-assert for live gaps)
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'campaign_create_fee_label', COALESCE(
    NULLIF(trim(value->>'campaign_create_fee_label'), ''),
    'Create fee'
  ),
  'campaign_create_fee_blurb', COALESCE(
    NULLIF(trim(value->>'campaign_create_fee_blurb'), ''),
    'Pay once from your wallet to publish this campaign. No pay, no campaign.'
  ),
  'publisher_pricing_unavailable', COALESCE(
    NULLIF(trim(value->>'publisher_pricing_unavailable'), ''),
    'Ad pricing unavailable from server.'
  ),
  'publisher_page_body', COALESCE(
    NULLIF(trim(value->>'publisher_page_body'), ''),
    'Create campaigns, set spend caps, schedule in-match delivery, and manage creative status.'
  ),
  'amount_currency_separator', COALESCE(
    NULLIF(value->>'amount_currency_separator', ''),
    ' '
  )
),
    updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
