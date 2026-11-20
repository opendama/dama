-- Refund Policy as a third legal document (Play / App Store billing transparency).
-- Bodies are DB-only; clients never invent refund copy.

-- Expand site_legal_sections.doc_kind to include refunds.
ALTER TABLE site_legal_sections DROP CONSTRAINT IF EXISTS site_legal_sections_doc_kind_check;
ALTER TABLE site_legal_sections
  ADD CONSTRAINT site_legal_sections_doc_kind_check
  CHECK (doc_kind IN ('privacy', 'terms', 'refunds'));

COMMENT ON TABLE site_legal_sections IS
  'Privacy, Terms, and Refunds section bodies. Operators update rows; clients never invent legal copy.';

INSERT INTO site_legal_sections
  (doc_kind, sort_order, heading, body, contact_lead, contact_trail, uses_support_email)
VALUES
  (
    'refunds', 10, '',
    'This Refund Policy explains when dama may refund wallet top-ups, tournament entry fees, and Ad Publisher campaign spend for the web player, mobile apps, and related APIs. It is written for Google Play and Apple App Store transparency requirements and for regional consumer payment rules that apply to digital skill-game services.',
    '', '', false
  ),
  (
    'refunds', 20, 'What this policy covers',
    'Covered charges include: (1) wallet top-ups processed by regional providers such as Chapa or international processors such as Paddle, (2) tournament entry fees debited from your in-app wallet, and (3) Ad Publisher campaign spend and related billing on the platform. Purchases you make outside dama (for example device app-store media unrelated to dama) are not covered here.',
    '', '', false
  ),
  (
    'refunds', 30, 'Tournament entry fees',
    'Paid tournament entry fees are charged when enrollment succeeds. If enrollment fails after a wallet debit, the platform attempts an automatic wallet credit. Once you are enrolled and the event has started or you have played, entry fees are generally non-refundable except where required by law or where we confirm a platform error. Free tournaments do not charge an entry fee.',
    '', '', false
  ),
  (
    'refunds', 40, 'Wallet top-ups',
    'Wallet top-ups credit digital balance used for tournaments and related features. We may refund a top-up when we charged you in error, duplicated a payment, failed to credit a successful charge, or when applicable consumer or payment law requires a refund. Except where required by law, we generally do not refund unused wallet balance after you have spent funds on eligible features, or fees retained by payment partners that cannot be reversed.',
    '', '', false
  ),
  (
    'refunds', 50, 'Ad Publisher spend',
    'Publisher campaign spend, daily caps, and related billing follow the campaign schedule and pricing configured on the platform. Unused scheduled budget may remain available for your campaigns according to product rules. Refunds of publisher spend are limited to confirmed billing errors, duplicate charges, or legal requirements. Pausing or ending a campaign does not automatically refund impressions or clicks already delivered.',
    '', '', false
  ),
  (
    'refunds', 60, 'App Store and Google Play',
    'If you purchased or tipped through Apple App Store or Google Play billing (when enabled for your build), store refund requests may also be submitted through Apple or Google according to their policies. We cooperate with store investigations. Store decisions and dama wallet credits are coordinated so you are not double-compensated for the same charge.',
    '', '', false
  ),
  (
    'refunds', 70, 'How to request a refund',
    'Contact support from the email on your account. Include the payment date, amount, currency, provider reference (for example Chapa tx_ref or Paddle transaction id), and whether the charge was a wallet top-up, tournament entry, or publisher spend. We aim to respond within a reasonable timeframe. Approved refunds return to the original payment method when the processor allows it; otherwise we may credit your dama wallet.',
    'Contact', 'for refund or billing questions.', true
  ),
  (
    'refunds', 80, 'Chargebacks and disputes',
    'If a charge looks wrong, contact us before opening a chargeback so we can investigate. Chargebacks opened without contacting support may delay resolution and can lead to account review under the Terms of Service. Nothing in this policy limits rights you cannot waive under the laws of your country or region.',
    '', '', false
  )
ON CONFLICT (doc_kind, sort_order) DO NOTHING;

-- Legal chrome: refund title + nav label (fail closed with privacy/terms).
UPDATE platform_settings
SET value = value || '{
  "refunds_title": "Refund Policy",
  "refunds_nav_label": "Refunds"
}'::jsonb,
updated_at = NOW()
WHERE key = 'legal_chrome';

-- Store compliance: refund link label beside privacy/terms.
UPDATE platform_settings
SET value = value || '{
  "refunds_link_label": "Refund Policy"
}'::jsonb,
updated_at = NOW()
WHERE key = 'store_compliance_chrome';

-- Marketing / player / mobile nav: Refunds route (titles may be overridden by legal_chrome on clients).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{marketing}',
  COALESCE(value->'marketing', '[]'::jsonb) || '[
    {"title": "Refunds", "href": "/refunds", "route_key": "refunds"}
  ]'::jsonb
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(value->'marketing', '[]'::jsonb)) el
    WHERE el->>'route_key' = 'refunds'
  );

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{player}',
  COALESCE(value->'player', '[]'::jsonb) || '[
    {"title": "Refunds", "href": "/refunds", "route_key": "refunds"}
  ]'::jsonb
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(value->'player', '[]'::jsonb)) el
    WHERE el->>'route_key' = 'refunds'
  );

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{mobile}',
  COALESCE(value->'mobile', '[]'::jsonb) || '[
    {"title": "Refunds", "route_key": "refunds"}
  ]'::jsonb
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(value->'mobile', '[]'::jsonb)) el
    WHERE el->>'route_key' = 'refunds'
  );
