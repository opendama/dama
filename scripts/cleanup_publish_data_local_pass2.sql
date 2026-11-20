-- Publish data cleanup pass 2 (LOCAL). DATA rows only. No DROP DATABASE / No DROP TABLE.
-- KEEP users: bereketgezha@gmail.com, ihate*, telegram ops reviewer.
-- KEEP config: platform_settings/chrome, feature_flags rows, RBAC, notification_kinds,
--              payment_accounts, youtube_channels (platform credentials).
-- CLEAR: test admins, test ads, social leftovers, audit/visit/geo, otp/kyc/devices,
--        non-kept users.

BEGIN;

CREATE TEMP TABLE keep_users AS
SELECT id
FROM users
WHERE email = 'bereketgezha@gmail.com'
   OR username ILIKE 'ihate%'
   OR email ILIKE '%ihate%'
   OR id = '29c29227-d741-45eb-8c9e-93583bf1ab37';

-- Detach nullable auditor refs only; do not delete feature_flags rows / chrome.
UPDATE feature_flags
SET updated_by = NULL
WHERE updated_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM keep_users k WHERE k.id = updated_by);

UPDATE game_chat_settings
SET updated_by = NULL
WHERE updated_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM keep_users k WHERE k.id = updated_by);

UPDATE youtube_upload_jobs
SET publisher_id = NULL
WHERE publisher_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM keep_users k WHERE k.id = publisher_id);

-- Test ads + social/ops leftovers (tables remain).
TRUNCATE TABLE
  ad_impression_events,
  ad_unique_viewers,
  ad_campaigns,
  dm_message_reactions,
  dm_thread_reads,
  dm_messages,
  dm_requests,
  dm_threads,
  friend_requests,
  player_friends,
  device_fingerprints,
  otp_challenges,
  kyc_document_submissions,
  user_activity_days,
  audit_log,
  platform_visit_days,
  geo_ip_records,
  youtube_upload_jobs
RESTART IDENTITY;

-- Money shells for non-kept users only.
DELETE FROM wallets w
WHERE NOT EXISTS (SELECT 1 FROM keep_users k WHERE k.id = w.user_id);

DELETE FROM user_payout_methods m
WHERE NOT EXISTS (SELECT 1 FROM keep_users k WHERE k.id = m.user_id);

-- Non-kept users only (CASCADE clears remaining dependents).
DELETE FROM users u
WHERE NOT EXISTS (SELECT 1 FROM keep_users k WHERE k.id = u.id);

DO $$
DECLARE
  n_settings int;
  n_flags int;
  n_rbac int;
  n_kinds int;
  n_pay_acct int;
  n_yt_ch int;
  n_users int;
  n_ihate int;
  n_bereket int;
  n_ops int;
  n_ads int;
  n_dm int;
  n_audit int;
  n_admin_extra int;
BEGIN
  SELECT COUNT(*) INTO n_settings FROM platform_settings;
  SELECT COUNT(*) INTO n_flags FROM feature_flags;
  SELECT COUNT(*) INTO n_rbac FROM rbac_permissions;
  SELECT COUNT(*) INTO n_kinds FROM notification_kinds;
  SELECT COUNT(*) INTO n_pay_acct FROM payment_accounts;
  SELECT COUNT(*) INTO n_yt_ch FROM youtube_channels;
  SELECT COUNT(*) INTO n_users FROM users;
  SELECT COUNT(*) INTO n_ihate FROM users WHERE username ILIKE 'ihate%' OR email ILIKE '%ihate%';
  SELECT COUNT(*) INTO n_bereket FROM users WHERE email = 'bereketgezha@gmail.com';
  SELECT COUNT(*) INTO n_ops FROM users WHERE id = '29c29227-d741-45eb-8c9e-93583bf1ab37';
  SELECT COUNT(*) INTO n_ads FROM ad_campaigns;
  SELECT COUNT(*) INTO n_dm FROM dm_messages;
  SELECT COUNT(*) INTO n_audit FROM audit_log;
  SELECT COUNT(*) INTO n_admin_extra FROM users
    WHERE role IN ('admin', 'superadmin', 'console')
      AND email <> 'bereketgezha@gmail.com'
      AND id <> '29c29227-d741-45eb-8c9e-93583bf1ab37';

  IF n_settings < 1 OR n_flags < 1 OR n_rbac < 1 OR n_kinds < 1 THEN
    RAISE EXCEPTION 'fail-closed: config/catalog missing';
  END IF;
  IF n_pay_acct < 1 THEN
    RAISE EXCEPTION 'fail-closed: payment_accounts missing';
  END IF;
  IF n_bereket <> 1 THEN
    RAISE EXCEPTION 'fail-closed: bereketgezha admin missing';
  END IF;
  IF n_ihate < 1 THEN
    RAISE EXCEPTION 'fail-closed: ihate users missing';
  END IF;
  IF n_ops <> 1 THEN
    RAISE EXCEPTION 'fail-closed: telegram ops reviewer missing';
  END IF;
  IF n_ads <> 0 OR n_dm <> 0 OR n_audit <> 0 THEN
    RAISE EXCEPTION 'fail-closed: leftover ads/social/audit not cleared';
  END IF;
  IF n_admin_extra <> 0 THEN
    RAISE EXCEPTION 'fail-closed: extra admin users remain';
  END IF;
  IF n_users <> (n_ihate + n_bereket + n_ops) THEN
    RAISE EXCEPTION 'fail-closed: unexpected leftover users=% (ihate=% bereket=% ops=%)',
      n_users, n_ihate, n_bereket, n_ops;
  END IF;

  RAISE NOTICE 'pass2_ok settings=% flags=% rbac=% kinds=% pay=% yt=% users=% ihate=%',
    n_settings, n_flags, n_rbac, n_kinds, n_pay_acct, n_yt_ch, n_users, n_ihate;
END $$;

COMMIT;
