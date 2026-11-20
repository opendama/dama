-- Trim receipt totals parity: Subtotal / VAT / Total / Amount paid + line tax cols.
-- Fail-closed: seeds empty keys only. Payment receipts without tax still show 0 VAT.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'receipt_label_subtotal', COALESCE(NULLIF(trim(value->>'receipt_label_subtotal'), ''), 'Subtotal'),
  'receipt_label_tax', COALESCE(NULLIF(trim(value->>'receipt_label_tax'), ''), 'VAT'),
  'receipt_label_total', COALESCE(NULLIF(trim(value->>'receipt_label_total'), ''), 'Total'),
  'receipt_label_amount_paid', COALESCE(NULLIF(trim(value->>'receipt_label_amount_paid'), ''), 'Amount paid'),
  'receipt_col_qty', COALESCE(NULLIF(trim(value->>'receipt_col_qty'), ''), 'Qty'),
  'receipt_col_unit', COALESCE(NULLIF(trim(value->>'receipt_col_unit'), ''), 'Unit'),
  'receipt_col_tax_rate', COALESCE(NULLIF(trim(value->>'receipt_col_tax_rate'), ''), 'Tax'),
  'receipt_section_tax_breakdown', COALESCE(NULLIF(trim(value->>'receipt_section_tax_breakdown'), ''), 'Tax breakdown'),
  'receipt_label_tax_percent', COALESCE(NULLIF(trim(value->>'receipt_label_tax_percent'), ''), 'Rate'),
  'receipt_label_tax_total', COALESCE(NULLIF(trim(value->>'receipt_label_tax_total'), ''), 'Tax total'),
  'receipt_tax_rate_display', COALESCE(NULLIF(trim(value->>'receipt_tax_rate_display'), ''), '0%')
),
updated_at = NOW()
WHERE key = 'wallet_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
    'receipt_label_subtotal', COALESCE(NULLIF(trim(value->'payments'->>'receipt_label_subtotal'), ''), 'Subtotal'),
    'receipt_label_tax', COALESCE(NULLIF(trim(value->'payments'->>'receipt_label_tax'), ''), 'VAT'),
    'receipt_label_total', COALESCE(NULLIF(trim(value->'payments'->>'receipt_label_total'), ''), 'Total'),
    'receipt_label_amount_paid', COALESCE(NULLIF(trim(value->'payments'->>'receipt_label_amount_paid'), ''), 'Amount paid'),
    'receipt_col_qty', COALESCE(NULLIF(trim(value->'payments'->>'receipt_col_qty'), ''), 'Qty'),
    'receipt_col_unit', COALESCE(NULLIF(trim(value->'payments'->>'receipt_col_unit'), ''), 'Unit'),
    'receipt_col_tax_rate', COALESCE(NULLIF(trim(value->'payments'->>'receipt_col_tax_rate'), ''), 'Tax'),
    'receipt_section_tax_breakdown', COALESCE(NULLIF(trim(value->'payments'->>'receipt_section_tax_breakdown'), ''), 'Tax breakdown'),
    'receipt_label_tax_percent', COALESCE(NULLIF(trim(value->'payments'->>'receipt_label_tax_percent'), ''), 'Rate'),
    'receipt_label_tax_total', COALESCE(NULLIF(trim(value->'payments'->>'receipt_label_tax_total'), ''), 'Tax total'),
    'receipt_tax_rate_display', COALESCE(NULLIF(trim(value->'payments'->>'receipt_tax_rate_display'), ''), '0%')
  ),
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
