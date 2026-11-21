-- Mobile store packaging + public SEO robots/sitemap paths on app_shell_chrome.
-- Soft-fill only; idempotent. Native Android/iOS IDs and OAuth scheme must match these values.
-- SEO path lists mirror existing public surfaces (no new product routes invented).

UPDATE platform_settings
SET value = value || jsonb_strip_nulls(jsonb_build_object(
  'mobile_android_application_id', COALESCE(NULLIF(trim(value->>'mobile_android_application_id'), ''), 'com.opendama.mobile'),
  'mobile_ios_bundle_id', COALESCE(NULLIF(trim(value->>'mobile_ios_bundle_id'), ''), 'com.opendama.mobile'),
  'mobile_display_name', COALESCE(NULLIF(trim(value->>'mobile_display_name'), ''), 'Dama'),
  'mobile_oauth_scheme', COALESCE(NULLIF(trim(value->>'mobile_oauth_scheme'), ''), 'com.opendama.mobile'),
  'mobile_oauth_host', COALESCE(NULLIF(trim(value->>'mobile_oauth_host'), ''), 'login-callback'),
  'mobile_oauth_redirect_url', COALESCE(NULLIF(trim(value->>'mobile_oauth_redirect_url'), ''), 'com.opendama.mobile://login-callback/'),
  'seo_locale', COALESCE(NULLIF(trim(value->>'seo_locale'), ''), 'en_US'),
  'seo_og_type', COALESCE(NULLIF(trim(value->>'seo_og_type'), ''), 'website'),
  'seo_robots_allow', COALESCE(NULLIF(trim(value->>'seo_robots_allow'), ''), E'/\n/privacy\n/terms\n/refunds\n/tournaments\n/play\n/leaderboard'),
  'seo_robots_disallow', COALESCE(NULLIF(trim(value->>'seo_robots_disallow'), ''), E'/dashboard\n/wallet\n/transactions\n/receipts\n/settings\n/profile\n/ads/\n/events/\n/auth/\n/api/\n/matchmaking\n/spectate\n/players/'),
  'seo_sitemap', COALESCE(NULLIF(trim(value->>'seo_sitemap'), ''), E'/|daily|1\n/play|daily|0.9\n/tournaments|hourly|0.9\n/leaderboard|daily|0.8\n/privacy|yearly|0.3\n/terms|yearly|0.3\n/refunds|yearly|0.3')
)),
    updated_at = NOW()
WHERE key = 'app_shell_chrome';
