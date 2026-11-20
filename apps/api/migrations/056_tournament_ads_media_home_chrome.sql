-- Tournament prize media + gallery; ads thumbnail + gallery; home/payment chrome; bottom nav.

-- Tournaments: prize image + gallery (URLs from media upload only).
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS prize_image_url TEXT,
  ADD COLUMN IF NOT EXISTS gallery JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Ads campaigns: thumbnail + gallery for carousel cards.
ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS gallery JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Home surface chrome (fail-closed; no client invent).
INSERT INTO platform_settings (key, value) VALUES
  (
    'home_surface_chrome',
    '{
      "live_section_title": "Live tournaments",
      "live_section_blurb": "Enroll with wallet balance or top up to join.",
      "players_label": "players",
      "prize_label": "Prize",
      "entry_label": "Entry",
      "free_label": "Free",
      "enroll_cta": "Enroll",
      "top_up_cta": "Top up to enroll",
      "empty_live": "No live tournaments right now.",
      "home_chrome_unavailable": "Home chrome unavailable",
      "carousel_aria": "Tournament gallery"
    }'::jsonb
  )
ON CONFLICT (key) DO NOTHING;

-- Payment / enroll modal chrome (wallet debit + top-up redirect).
INSERT INTO platform_settings (key, value) VALUES
  (
    'payment_modal_chrome',
    '{
      "title": "Confirm enrollment",
      "blurb": "Entry fee is charged from your wallet balance.",
      "balance_label": "Wallet balance",
      "fee_label": "Entry fee",
      "confirm_action": "Pay and enroll",
      "cancel_action": "Cancel",
      "insufficient_title": "Insufficient balance",
      "insufficient_blurb": "Top up your wallet, then return to enroll.",
      "top_up_action": "Open wallet top-up",
      "methods_title": "Payment methods",
      "methods_blurb": "Complete checkout with your regional payment provider.",
      "checkout_action": "Continue to checkout",
      "amount_label": "Top-up amount",
      "payment_modal_unavailable": "Payment modal chrome unavailable",
      "enroll_success": "Enrolled",
      "enroll_failed": "Enrollment failed",
      "already_enrolled": "Already enrolled"
    }'::jsonb
  )
ON CONFLICT (key) DO NOTHING;

-- Ads creative media chrome.
UPDATE platform_settings
SET value = value || '{
  "thumbnail_label": "Thumbnail",
  "gallery_label": "Gallery",
  "gallery_add_action": "Add gallery image",
  "gallery_empty": "No gallery images yet",
  "thumbnail_upload_action": "Upload thumbnail",
  "toast_thumbnail_saved": "Thumbnail saved",
  "toast_gallery_saved": "Gallery updated",
  "media_upload_failed": "Media upload failed"
}'::jsonb,
updated_at = NOW()
WHERE key = 'ad_runtime_chrome';

-- Bottom nav surfaces (player + mobile) - titles/hrefs from DB only.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{bottom_nav}',
  '{
    "player": [
      {"title": "Home", "href": "/dashboard", "route_key": "dashboard"},
      {"title": "Play", "href": "/play", "route_key": "play"},
      {"title": "Tournaments", "href": "/tournaments", "route_key": "tournaments"},
      {"title": "Wallet", "href": "/wallet", "route_key": "wallet"},
      {"title": "Profile", "href": "/profile", "route_key": "profile"}
    ],
    "mobile": [
      {"title": "Home", "route_key": "home"},
      {"title": "Play", "route_key": "play"},
      {"title": "Tournaments", "route_key": "tournaments"},
      {"title": "Wallet", "route_key": "wallet"},
      {"title": "Profile", "route_key": "profile"}
    ],
    "ads": [
      {"title": "Dashboard", "href": "/ads/dashboard", "route_key": "ads_dashboard"},
      {"title": "Campaigns", "href": "/ads/campaigns", "route_key": "ads_campaigns"},
      {"title": "Analytics", "href": "/ads/analytics", "route_key": "ads_analytics"}
    ]
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'client_nav';
