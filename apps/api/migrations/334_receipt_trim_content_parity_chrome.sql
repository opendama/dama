-- Trim receipt content parity (Dama wallet behaviour):
-- - Invoice to / Invoice from / Invoice details / Payment method labels
-- - Product / Unit price / Tax rate / Tax % column labels
-- - Currency code detail row + header meta separator (date - amount)
-- - Support-oriented footer copy (no Paddle MoR - Dama has none)

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'receipt_section_bill_to', 'Invoice to',
  'receipt_section_from', 'Invoice from',
  'receipt_section_details', 'Invoice details',
  'receipt_section_payment', 'Payment method',
  'receipt_label_reference', 'Invoice reference',
  'receipt_label_currency', COALESCE(NULLIF(trim(value->>'receipt_label_currency'), ''), 'Currency code'),
  'receipt_header_meta_separator', COALESCE(
    NULLIF(value->>'receipt_header_meta_separator', ''),
    ' - '
  ),
  'receipt_col_description', 'Product',
  'receipt_col_product', COALESCE(NULLIF(trim(value->>'receipt_col_product'), ''), 'Product'),
  'receipt_col_unit', 'Unit price',
  'receipt_col_tax_rate', 'Tax rate',
  'receipt_label_tax_percent', 'Tax %',
  'receipt_footer', 'Questions about this receipt? Contact support using the address on this document.'
),
updated_at = NOW()
WHERE key = 'wallet_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
    'receipt_section_bill_to', 'Invoice to',
    'receipt_section_from', 'Invoice from',
    'receipt_section_details', 'Invoice details',
    'receipt_section_payment', 'Payment method',
    'receipt_label_reference', 'Invoice reference',
    'receipt_label_currency', COALESCE(NULLIF(trim(value->'payments'->>'receipt_label_currency'), ''), 'Currency code'),
    'receipt_header_meta_separator', COALESCE(
      NULLIF(value->'payments'->>'receipt_header_meta_separator', ''),
      ' - '
    ),
    'receipt_col_description', 'Product',
    'receipt_col_product', COALESCE(NULLIF(trim(value->'payments'->>'receipt_col_product'), ''), 'Product'),
    'receipt_col_unit', 'Unit price',
    'receipt_col_tax_rate', 'Tax rate',
    'receipt_label_tax_percent', 'Tax %',
    'receipt_footer', 'Questions about this receipt? Contact support using the address on this document.'
  ),
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
