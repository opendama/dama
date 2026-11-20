-- Host Sizes Unlimited toggle: max must be empty (true uncapped) or above the
-- DB classic seat ceiling (high safety). Classic-range max with Unlimited on
-- would silently save as a fixed Arena size; reject with chrome.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'err_unlimited_max_high_or_empty', COALESCE(
    NULLIF(trim(value->>'err_unlimited_max_high_or_empty'), ''),
    'For Unlimited, leave max empty or set a high safety ceiling above the classic seat table'
  )
),
updated_at = NOW()
WHERE key = 'events_admin_chrome';
