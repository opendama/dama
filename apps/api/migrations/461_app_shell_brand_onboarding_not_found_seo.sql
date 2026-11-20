-- App shell chrome: splash, first-run onboarding, branded 404, SEO image paths.
-- Fail-closed public GET /public/app-shell-chrome. Soft-fill only; idempotent.
-- User-facing copy is global / international (not country-local marketing).

INSERT INTO platform_settings (key, value) VALUES
  (
    'app_shell_chrome',
    '{
      "source": "database",
      "app_shell_unavailable": "Brand shell unavailable",
      "splash_hold_ms": "1400",
      "splash_unavailable": "Splash unavailable",
      "not_found_code": "404",
      "not_found_title": "Page not found",
      "not_found_blurb": "This page does not exist or was moved.",
      "not_found_home_action": "Back to home",
      "not_found_home_href": "/",
      "onboarding_unavailable": "Onboarding unavailable",
      "skip_action": "Skip",
      "next_action": "Next",
      "done_action": "Get started",
      "slide_1_title": "Play international draughts",
      "slide_1_blurb": "Official 10x10 dama with live clocks, rated matches, and practice vs computer.",
      "slide_2_title": "Tournaments and Hosting",
      "slide_2_blurb": "Join Official cups or host your own. Wallet entry, brackets, and prize settle.",
      "slide_3_title": "Wallet, Ads, and rewards",
      "slide_3_blurb": "Top up securely, publish ads, and track receipts across player and publisher portals.",
      "og_image_path": "/og-image.png",
      "favicon_light_path": "/brand/dama-mark.png",
      "favicon_dark_path": "/brand/dama-mark-white.png",
      "apple_touch_icon_path": "/apple-touch-icon.png",
      "manifest_name": "Dama",
      "manifest_short_name": "Dama",
      "manifest_description": "International draughts. Play, tournaments, wallet.",
      "manifest_theme_color": "#A31D38",
      "manifest_background_color_light": "#FAFAFA",
      "manifest_background_color_dark": "#0A0A0B",
      "twitter_card": "summary_large_image",
      "robots_index": "index, follow",
      "admin_robots": "noindex, nofollow",
      "admin_not_found_home_href": "/"
    }'::jsonb
  )
ON CONFLICT (key) DO NOTHING;

-- Soft-fill any missing keys if row already exists from a partial apply.
UPDATE platform_settings
SET value = value || jsonb_strip_nulls(jsonb_build_object(
  'source', COALESCE(NULLIF(trim(value->>'source'), ''), 'database'),
  'app_shell_unavailable', COALESCE(NULLIF(trim(value->>'app_shell_unavailable'), ''), 'Brand shell unavailable'),
  'splash_hold_ms', COALESCE(NULLIF(trim(value->>'splash_hold_ms'), ''), '1400'),
  'splash_unavailable', COALESCE(NULLIF(trim(value->>'splash_unavailable'), ''), 'Splash unavailable'),
  'not_found_code', COALESCE(NULLIF(trim(value->>'not_found_code'), ''), '404'),
  'not_found_title', COALESCE(NULLIF(trim(value->>'not_found_title'), ''), 'Page not found'),
  'not_found_blurb', COALESCE(NULLIF(trim(value->>'not_found_blurb'), ''), 'This page does not exist or was moved.'),
  'not_found_home_action', COALESCE(NULLIF(trim(value->>'not_found_home_action'), ''), 'Back to home'),
  'not_found_home_href', COALESCE(NULLIF(trim(value->>'not_found_home_href'), ''), '/'),
  'onboarding_unavailable', COALESCE(NULLIF(trim(value->>'onboarding_unavailable'), ''), 'Onboarding unavailable'),
  'skip_action', COALESCE(NULLIF(trim(value->>'skip_action'), ''), 'Skip'),
  'next_action', COALESCE(NULLIF(trim(value->>'next_action'), ''), 'Next'),
  'done_action', COALESCE(NULLIF(trim(value->>'done_action'), ''), 'Get started'),
  'slide_1_title', COALESCE(NULLIF(trim(value->>'slide_1_title'), ''), 'Play international draughts'),
  'slide_1_blurb', COALESCE(NULLIF(trim(value->>'slide_1_blurb'), ''), 'Official 10x10 dama with live clocks, rated matches, and practice vs computer.'),
  'slide_2_title', COALESCE(NULLIF(trim(value->>'slide_2_title'), ''), 'Tournaments and Hosting'),
  'slide_2_blurb', COALESCE(NULLIF(trim(value->>'slide_2_blurb'), ''), 'Join Official cups or host your own. Wallet entry, brackets, and prize settle.'),
  'slide_3_title', COALESCE(NULLIF(trim(value->>'slide_3_title'), ''), 'Wallet, Ads, and rewards'),
  'slide_3_blurb', COALESCE(NULLIF(trim(value->>'slide_3_blurb'), ''), 'Top up securely, publish ads, and track receipts across player and publisher portals.'),
  'og_image_path', COALESCE(NULLIF(trim(value->>'og_image_path'), ''), '/og-image.png'),
  'favicon_light_path', COALESCE(NULLIF(trim(value->>'favicon_light_path'), ''), '/brand/dama-mark.png'),
  'favicon_dark_path', COALESCE(NULLIF(trim(value->>'favicon_dark_path'), ''), '/brand/dama-mark-white.png'),
  'apple_touch_icon_path', COALESCE(NULLIF(trim(value->>'apple_touch_icon_path'), ''), '/apple-touch-icon.png'),
  'manifest_name', COALESCE(NULLIF(trim(value->>'manifest_name'), ''), 'Dama'),
  'manifest_short_name', COALESCE(NULLIF(trim(value->>'manifest_short_name'), ''), 'Dama'),
  'manifest_description', COALESCE(NULLIF(trim(value->>'manifest_description'), ''), 'International draughts. Play, tournaments, wallet.'),
  'manifest_theme_color', COALESCE(NULLIF(trim(value->>'manifest_theme_color'), ''), '#A31D38'),
  'manifest_background_color_light', COALESCE(NULLIF(trim(value->>'manifest_background_color_light'), ''), '#FAFAFA'),
  'manifest_background_color_dark', COALESCE(NULLIF(trim(value->>'manifest_background_color_dark'), ''), '#0A0A0B'),
  'twitter_card', COALESCE(NULLIF(trim(value->>'twitter_card'), ''), 'summary_large_image'),
  'robots_index', COALESCE(NULLIF(trim(value->>'robots_index'), ''), 'index, follow'),
  'admin_robots', COALESCE(NULLIF(trim(value->>'admin_robots'), ''), 'noindex, nofollow'),
  'admin_not_found_home_href', COALESCE(NULLIF(trim(value->>'admin_not_found_home_href'), ''), '/')
)),
    updated_at = NOW()
WHERE key = 'app_shell_chrome';
