-- Dama ↔ shared telegram_bot ops bridge for manual receipt + payout review.
-- All runtime config is platform_settings.telegram_ops_bot (no client hardcodes).
-- enabled=false until ops fills bot_service_url, bot_api_key, and reviewer_user_id.

INSERT INTO platform_settings (key, value, updated_at)
VALUES (
  'telegram_ops_bot',
  '{
    "enabled": false,
    "bot_service_url": "",
    "bot_api_key": "",
    "reviewer_user_id": "",
    "notify_timeout_ms": 10000,
    "notify_receipt_type": "dama_receipt_pending",
    "notify_payout_type": "dama_payout_pending",
    "product_label": "Dama",
    "receipt_hub_title": "Dama manual receipts",
    "receipt_hub_empty": "No pending Dama receipts.",
    "receipt_detail_title": "Dama receipt detail",
    "receipt_notify_title": "New Dama manual receipt",
    "payout_hub_title": "Dama payout requests",
    "payout_hub_empty": "No pending Dama payouts.",
    "payout_detail_title": "Dama payout detail",
    "payout_notify_title": "New Dama payout request",
    "btn_view_details": "View details",
    "btn_view_hub": "View hub",
    "btn_approve": "Approve",
    "btn_reject": "Reject",
    "btn_mark_paid": "Mark paid",
    "btn_back_hub": "Back to hub",
    "btn_close": "Close",
    "err_bot_not_configured": "Dama telegram ops bot is not configured.",
    "err_unauthorized_bot": "Unauthorized bot request.",
    "err_reviewer_missing": "telegram_ops_bot.reviewer_user_id is required when enabled."
  }'::jsonb,
  NOW()
)
-- Re-apply safe: never clobber ops secrets / enable flag with seed defaults.
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value || platform_settings.value,
    updated_at = NOW();

-- Admin console chrome for Telegram ops settings page.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
    'telegram_ops_page_title',
    COALESCE(NULLIF(trim(value->'payments'->>'telegram_ops_page_title'), ''), 'Telegram ops bot'),
    'telegram_ops_page_blurb',
    COALESCE(
      NULLIF(trim(value->'payments'->>'telegram_ops_page_blurb'), ''),
      'Bridge manual receipt and payout review to the shared Telegram ops bot. Secrets stay in the database.'
    ),
    'telegram_ops_section_title',
    COALESCE(NULLIF(trim(value->'payments'->>'telegram_ops_section_title'), ''), 'Telegram ops bridge'),
    'telegram_ops_load_failed',
    COALESCE(NULLIF(trim(value->'payments'->>'telegram_ops_load_failed'), ''), 'Failed to load Telegram ops settings.'),
    'telegram_ops_enabled_label',
    COALESCE(NULLIF(trim(value->'payments'->>'telegram_ops_enabled_label'), ''), 'Enabled'),
    'telegram_ops_bot_service_url_label',
    COALESCE(NULLIF(trim(value->'payments'->>'telegram_ops_bot_service_url_label'), ''), 'Bot service URL'),
    'telegram_ops_bot_api_key_label',
    COALESCE(NULLIF(trim(value->'payments'->>'telegram_ops_bot_api_key_label'), ''), 'Bot API key (X-Bot-Key)'),
    'telegram_ops_bot_api_key_hint',
    COALESCE(
      NULLIF(trim(value->'payments'->>'telegram_ops_bot_api_key_hint'), ''),
      'Leave blank to keep the current key. Bot env DAMA_BOT_API_KEY must match.'
    ),
    'telegram_ops_reviewer_user_id_label',
    COALESCE(
      NULLIF(trim(value->'payments'->>'telegram_ops_reviewer_user_id_label'), ''),
      'Reviewer user id (console user UUID for audit)'
    ),
    'telegram_ops_notify_timeout_ms_label',
    COALESCE(NULLIF(trim(value->'payments'->>'telegram_ops_notify_timeout_ms_label'), ''), 'Notify timeout (ms)'),
    'telegram_ops_has_api_key_label',
    COALESCE(NULLIF(trim(value->'payments'->>'telegram_ops_has_api_key_label'), ''), 'API key configured'),
    'save_telegram_ops_action',
    COALESCE(NULLIF(trim(value->'payments'->>'save_telegram_ops_action'), ''), 'Save Telegram ops'),
    'save_telegram_ops_pending',
    COALESCE(NULLIF(trim(value->'payments'->>'save_telegram_ops_pending'), ''), 'Saving Telegram ops…'),
    'toast_telegram_ops_saved',
    COALESCE(NULLIF(trim(value->'payments'->>'toast_telegram_ops_saved'), ''), 'Telegram ops saved'),
    'toast_telegram_ops_failed',
    COALESCE(NULLIF(trim(value->'payments'->>'toast_telegram_ops_failed'), ''), 'Telegram ops save failed')
  )
),
    updated_at = NOW()
WHERE key = 'admin_console_chrome';

-- Console nav: Telegram ops under Payments (modules + sections).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{modules}',
  (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM (
      SELECT elem
      FROM jsonb_array_elements(COALESCE(value->'modules', '[]'::jsonb)) AS elem
      WHERE elem->>'href' IS DISTINCT FROM '/payments/telegram-ops'
      UNION ALL
      SELECT jsonb_build_object(
        'title', 'Telegram ops',
        'href', '/payments/telegram-ops',
        'body', 'Shared Telegram bot bridge for manual receipt and payout review.'
      )
    ) AS t(elem)
  )
),
    updated_at = NOW()
WHERE key = 'console_nav';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{sections}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN sec->>'id' = 'payments' THEN
          jsonb_set(
            sec,
            '{items}',
            (
              SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
              FROM (
                SELECT item
                FROM jsonb_array_elements(COALESCE(sec->'items', '[]'::jsonb)) AS item
                WHERE item->>'id' IS DISTINCT FROM 'pay-telegram-ops'
                UNION ALL
                SELECT jsonb_build_object(
                  'id', 'pay-telegram-ops',
                  'label', 'Telegram ops',
                  'href', '/payments/telegram-ops'
                )
              ) AS items(item)
            )
          )
        ELSE sec
      END
    ), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'sections', '[]'::jsonb)) AS sec
  )
),
    updated_at = NOW()
WHERE key = 'console_nav';
