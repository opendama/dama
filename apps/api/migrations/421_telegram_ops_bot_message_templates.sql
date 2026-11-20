-- DB-driven hub/detail/notify/menu/action templates (no emoji/body hardcodes in telegram_bot).

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'hub_header_md_template',
  COALESCE(
    NULLIF(trim(value->>'hub_header_md_template'), ''),
    '📋 **{title}**
━━━━━━━━━━━━━━━━━━
'
  ),
  'hub_empty_md_template',
  COALESCE(
    NULLIF(trim(value->>'hub_empty_md_template'), ''),
    '✨ {empty}'
  ),
  'hub_receipt_button_template',
  COALESCE(
    NULLIF(trim(value->>'hub_receipt_button_template'), ''),
    '🧾 #{id_short} - {amount} {currency} - {display}'
  ),
  'hub_payout_button_template',
  COALESCE(
    NULLIF(trim(value->>'hub_payout_button_template'), ''),
    '💸 #{id_short} - {amount} {currency} - {display} ({method}/{status})'
  ),
  'receipt_detail_html_template',
  COALESCE(
    NULLIF(trim(value->>'receipt_detail_html_template'), ''),
    '📑 <b>{title}</b>
━━━━━━━━━━━━━━━━━━
🆔 <code>{id}</code>
👤 {name}
✉️ <code>{email}</code>
📞 <code>{phone}</code>
💰 <b>{amount} {currency}</b>
🖼️ {receipt_url}
📌 {status}
🕒 {created}
'
  ),
  'payout_detail_html_template',
  COALESCE(
    NULLIF(trim(value->>'payout_detail_html_template'), ''),
    '📑 <b>{title}</b>
━━━━━━━━━━━━━━━━━━
🆔 <code>{id}</code>
👤 {name}
✉️ <code>{email}</code>
📞 <code>{phone}</code>
💰 <b>{amount} {currency}</b>
💳 {method}
📌 {status}
🕒 {created}
'
  ),
  'receipt_notify_html_template',
  COALESCE(
    NULLIF(trim(value->>'receipt_notify_html_template'), ''),
    '🧾 <b>{title}</b>
<i>{product}</i>

🆔 <code>{id}</code>
👤 <b>{sender}</b>
📞 <code>{phone}</code>
💵 <b>{amount} {currency}</b>
{screenshot_block}'
  ),
  'payout_notify_html_template',
  COALESCE(
    NULLIF(trim(value->>'payout_notify_html_template'), ''),
    '💸 <b>{title}</b>
<i>{product}</i>

🆔 <code>{id}</code>
👤 <b>{sender}</b>
📞 <code>{phone}</code>
💳 <code>{method}</code>
💵 <b>{amount} {currency}</b>
'
  ),
  'screenshot_line_template',
  COALESCE(
    NULLIF(trim(value->>'screenshot_line_template'), ''),
    '🖼️ {url}
'
  ),
  'button_truncate_suffix',
  COALESCE(NULLIF(trim(value->>'button_truncate_suffix'), ''), '...'),
  'action_result_md_template',
  COALESCE(
    NULLIF(trim(value->>'action_result_md_template'), ''),
    '`{id}` - {toast}'
  ),
  'action_reject_result_md_template',
  COALESCE(
    NULLIF(trim(value->>'action_reject_result_md_template'), ''),
    '`{id}` - {toast}: {reason}'
  ),
  -- Button labels may include glyphs in DB (bot uses chrome text as-is).
  'btn_approve',
  CASE
    WHEN coalesce(trim(value->>'btn_approve'), '') = '' THEN '✅ Approve'
    WHEN (value->>'btn_approve') LIKE '%✅%' THEN value->>'btn_approve'
    ELSE '✅ ' || trim(value->>'btn_approve')
  END,
  'btn_reject',
  CASE
    WHEN coalesce(trim(value->>'btn_reject'), '') = '' THEN '❌ Reject'
    WHEN (value->>'btn_reject') LIKE '%❌%' THEN value->>'btn_reject'
    ELSE '❌ ' || trim(value->>'btn_reject')
  END,
  'btn_mark_paid',
  CASE
    WHEN coalesce(trim(value->>'btn_mark_paid'), '') = '' THEN '💵 Mark paid'
    WHEN (value->>'btn_mark_paid') LIKE '%💵%' THEN value->>'btn_mark_paid'
    ELSE '💵 ' || trim(value->>'btn_mark_paid')
  END,
  'menu_receipts_label',
  CASE
    WHEN coalesce(trim(value->>'menu_receipts_label'), '') = '' THEN '🧾 Dama Receipts'
    WHEN (value->>'menu_receipts_label') LIKE '%🧾%' OR (value->>'menu_receipts_label') LIKE '%💸%'
      THEN value->>'menu_receipts_label'
    ELSE '🧾 ' || trim(value->>'menu_receipts_label')
  END,
  'menu_payouts_label',
  CASE
    WHEN coalesce(trim(value->>'menu_payouts_label'), '') = '' THEN '💸 Dama Payouts'
    WHEN (value->>'menu_payouts_label') LIKE '%🧾%' OR (value->>'menu_payouts_label') LIKE '%💸%'
      THEN value->>'menu_payouts_label'
    ELSE '💸 ' || trim(value->>'menu_payouts_label')
  END
),
    updated_at = NOW()
WHERE key = 'telegram_ops_bot';
