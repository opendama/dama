-- Trim-aligned console sidebar section labels + put Telemetry under Access
-- so every accordion group has 2+ leaves (no single-item "Platform" flat link).

UPDATE platform_settings
SET value = jsonb_set(
  jsonb_set(
    value,
    '{modules}',
    '[
      {"title":"Overview","href":"/dashboard","body":"Console home and live KPI summary."},
      {"title":"Activity","href":"/activity","body":"Live presence, visits, play volume, and DAU/WAU/MAU by day, week, month, or year."},
      {"title":"Tournaments","href":"/tournaments","body":"Create paid or free (is_free) tournaments with entry fee override."},
      {"title":"Events","href":"/events","body":"Host packages, formats, and join rules for Dama Events."},
      {"title":"Progression","href":"/progression","body":"XP ladder badges and match clock seconds from platform_settings."},
      {"title":"Currency","href":"/payments/currency","body":"Global and Ethiopia settlement currencies."},
      {"title":"Geo routing","href":"/payments/geo","body":"Domestic country and private default city/region."},
      {"title":"Document KYC","href":"/payments/kyc","body":"Government ID review queue for payout eligibility."},
      {"title":"Payouts","href":"/payments/payouts","body":"Approve, reject, and mark cash-out requests paid."},
      {"title":"Receipts","href":"/payments/receipts","body":"Manual transfer proof review with professional receipt detail."},
      {"title":"Transactions","href":"/payments/transactions","body":"Platform-wide top-ups, payouts, and wallet ledger."},
      {"title":"Banks","href":"/banks","body":"Manual transfer bank and mobile-money accounts for checkout."},
      {"title":"Users","href":"/users","body":"Players, publishers, and console roles with audit trail."},
      {"title":"Avatars","href":"/avatars","body":"Moderation queue for player avatar thumb and full assets."},
      {"title":"Ads runtime","href":"/ads","body":"In-match ad interval, non-skippable window, and campaign schedule caps."},
      {"title":"Media pool","href":"/media-pool","body":"Multi-channel upload pool with daily quota failover for ad creatives."},
      {"title":"Feature flags","href":"/feature-flags","body":"Toggle VS-AI practice, OTP gate, and Ethiopian payment mode."},
      {"title":"RBAC","href":"/rbac","body":"Roles catalog and permission grants (database-driven)."},
      {"title":"Telemetry","href":"/telemetry","body":"Fingerprints, GeoIP records, and immutable audit vault."}
    ]'::jsonb
  ),
  '{sections}',
  '[
    {"id":"overview","label":"Overview","items":[
      {"id":"dashboard","label":"Overview","href":"/dashboard"},
      {"id":"activity","label":"Activity","href":"/activity"}
    ]},
    {"id":"customers","label":"Customers","items":[
      {"id":"users","label":"Users","href":"/users"},
      {"id":"avatars","label":"Avatars","href":"/avatars"}
    ]},
    {"id":"sales","label":"Sales and revenue","items":[
      {"id":"pay-currency","label":"Currency","href":"/payments/currency"},
      {"id":"pay-geo","label":"Geo routing","href":"/payments/geo"},
      {"id":"pay-kyc","label":"Document KYC","href":"/payments/kyc"},
      {"id":"pay-payouts","label":"Payouts","href":"/payments/payouts"},
      {"id":"pay-receipts","label":"Receipts","href":"/payments/receipts"},
      {"id":"pay-transactions","label":"Transactions","href":"/payments/transactions"},
      {"id":"banks","label":"Banks","href":"/banks"}
    ]},
    {"id":"competition","label":"Competition","items":[
      {"id":"tournaments","label":"Tournaments","href":"/tournaments"},
      {"id":"events","label":"Events","href":"/events"},
      {"id":"progression","label":"Progression","href":"/progression"}
    ]},
    {"id":"product","label":"Product and growth","items":[
      {"id":"ads","label":"Ads runtime","href":"/ads"},
      {"id":"media-pool","label":"Media pool","href":"/media-pool"}
    ]},
    {"id":"access","label":"Access and security","items":[
      {"id":"feature-flags","label":"Feature flags","href":"/feature-flags"},
      {"id":"rbac","label":"RBAC","href":"/rbac"},
      {"id":"telemetry","label":"Telemetry","href":"/telemetry"}
    ]}
  ]'::jsonb
),
  updated_at = NOW()
WHERE key = 'console_nav';
