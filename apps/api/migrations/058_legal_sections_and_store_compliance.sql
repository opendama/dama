-- Public Privacy / Terms (DB-only bodies) + store compliance chrome (Play / App Store).
-- Pattern mirrors trim site_legal_sections: operators edit rows; API never invents legal copy.

CREATE TABLE IF NOT EXISTS site_legal_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_kind TEXT NOT NULL CHECK (doc_kind IN ('privacy', 'terms')),
  sort_order INT NOT NULL,
  heading TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  contact_lead TEXT NOT NULL DEFAULT '',
  contact_trail TEXT NOT NULL DEFAULT '',
  uses_support_email BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (doc_kind, sort_order)
);

COMMENT ON TABLE site_legal_sections IS
  'Privacy and Terms section bodies. Operators update rows; clients never invent legal copy.';

INSERT INTO site_legal_sections
  (doc_kind, sort_order, heading, body, contact_lead, contact_trail, uses_support_email)
VALUES
  (
    'privacy', 10, '',
    'dama is an international draughts skill-game platform. This Privacy Policy describes personal data we process when you use the web player, mobile apps, Ad Publisher portal, and related services.',
    '', '', false
  ),
  (
    'privacy', 20, 'Account and authentication',
    'Sign-in is social only (for example Google) through the providers enabled by the operator. We store your account id, email, display name, avatar URL, and authenticated provider name from the identity provider. We do not offer email/password sign-up.',
    '', '', false
  ),
  (
    'privacy', 30, 'Gameplay, wallets, and payments',
    'Match history, ratings, tournament enrollments, wallet balances, payout methods, and payment intents are stored server-side. Regional payment providers (for example Chapa or Paddle) or manual bank transfer may process top-ups according to your country route. Receipt images you upload for manual transfer are stored to verify payment.',
    '', '', false
  ),
  (
    'privacy', 40, 'Ads and device signals',
    'Ad campaigns, impressions, clicks, and geo-targeted serve events may be recorded for publishers and platform operations. Authenticated clients may send a device fingerprint and presence heartbeat for session security and fraud prevention. These signals are used for security and integrity, not for third-party advertising profiles.',
    '', '', false
  ),
  (
    'privacy', 50, 'Children',
    'The service is not directed to children under 13 (or the minimum age required in your jurisdiction). If you believe a child has created an account, contact us so we can delete it.',
    '', '', false
  ),
  (
    'privacy', 60, 'Your rights',
    'You may export or delete your account from the in-app account settings (store compliance). Billing and anti-fraud records required by law may be retained in anonymized or limited form where legally necessary.',
    'Contact', 'for privacy requests.', true
  ),
  (
    'terms', 10, '',
    'These Terms of Service govern use of the dama web player, mobile apps, Ad Publisher portal, and related APIs. By creating an account or using the service you agree to these terms.',
    '', '', false
  ),
  (
    'terms', 20, 'Accounts and eligibility',
    'You must sign in with an allowed social provider. One natural person should not create multiple accounts to abuse promotions, matchmaking, or wallets. We may suspend accounts that abuse device, network, or identity signals described in the Privacy Policy.',
    '', '', false
  ),
  (
    'terms', 30, 'Skill game and tournaments',
    'dama is a skill-based draughts product. Tournament entry fees, when charged, debit your in-app wallet. Free tournaments do not charge an entry fee. Outcomes depend on play; we do not guarantee winnings.',
    '', '', false
  ),
  (
    'terms', 40, 'Wallets and payouts',
    'Wallet top-ups follow the payment route for your detected country. Payout requests require a saved payout method and remain subject to review, compliance checks, and available balance. Chargebacks or fraud may reverse credits and suspend access.',
    '', '', false
  ),
  (
    'terms', 50, 'Ads Publisher',
    'Publishers may create campaigns with creative media, geo targets, and spend caps subject to platform policies and applicable advertising law. We may pause or remove creatives that violate policy.',
    '', '', false
  ),
  (
    'terms', 60, 'Termination',
    'You may delete your account at any time from account settings. We may suspend or terminate access for Terms or Privacy violations, unpaid obligations, or legal requirements.',
    'Contact', 'for terms questions.', true
  )
ON CONFLICT (doc_kind, sort_order) DO NOTHING;

-- Legal page chrome + store compliance UI strings (fail closed).
INSERT INTO platform_settings (key, value) VALUES
  (
    'legal_chrome',
    '{
      "privacy_title": "Privacy Policy",
      "terms_title": "Terms of Service",
      "last_updated_label": "Last updated",
      "privacy_nav_label": "Privacy",
      "terms_nav_label": "Terms",
      "support_email_key": "support_email",
      "legal_unavailable": "Legal content unavailable",
      "back_action": "Back"
    }'::jsonb
  )
ON CONFLICT (key) DO NOTHING;

INSERT INTO platform_settings (key, value) VALUES
  (
    'store_compliance_chrome',
    '{
      "account_section_title": "Account",
      "delete_account_title": "Delete account",
      "delete_account_blurb": "Permanently deletes your profile, match history links, wallet methods, and publisher campaigns you own. This cannot be undone.",
      "delete_account_action": "Delete my account",
      "delete_account_confirm": "Type DELETE to confirm",
      "delete_account_confirm_token": "DELETE",
      "delete_account_pending": "Deleting…",
      "delete_account_failed": "Account deletion failed",
      "delete_account_success": "Account deleted",
      "export_data_title": "Download my data",
      "export_data_blurb": "Download a copy of personal account fields we store for you.",
      "export_data_action": "Download data",
      "export_data_failed": "Data export failed",
      "export_filename": "dama-account-export.json",
      "privacy_link_label": "Privacy Policy",
      "terms_link_label": "Terms of Service",
      "store_compliance_unavailable": "Account compliance chrome unavailable"
    }'::jsonb
  )
ON CONFLICT (key) DO NOTHING;

-- Support email for legal contact trails (public-safe).
INSERT INTO platform_settings (key, value)
VALUES ('support_email', '"support@dama.app"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Marketing + player nav: Privacy / Terms links (hrefs only; titles from legal_chrome via clients that prefer chrome).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{marketing}',
  COALESCE(value->'marketing', '[]'::jsonb) || '[
    {"title": "Privacy", "href": "/privacy", "route_key": "privacy"},
    {"title": "Terms", "href": "/terms", "route_key": "terms"}
  ]'::jsonb
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(value->'marketing', '[]'::jsonb)) el
    WHERE el->>'route_key' = 'privacy'
  );

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{player}',
  COALESCE(value->'player', '[]'::jsonb) || '[
    {"title": "Privacy", "href": "/privacy", "route_key": "privacy"},
    {"title": "Terms", "href": "/terms", "route_key": "terms"}
  ]'::jsonb
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(value->'player', '[]'::jsonb)) el
    WHERE el->>'route_key' = 'privacy'
  );

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{mobile}',
  COALESCE(value->'mobile', '[]'::jsonb) || '[
    {"title": "Privacy", "route_key": "privacy"},
    {"title": "Terms", "route_key": "terms"}
  ]'::jsonb
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(value->'mobile', '[]'::jsonb)) el
    WHERE el->>'route_key' = 'privacy'
  );
