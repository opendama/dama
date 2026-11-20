-- Publisher invoice PDF body + API errors from DB chrome only (no English invent in PDF / handlers).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "invoice_pdf_title": "Dama Ad Publisher Invoice",
  "invoice_pdf_generated_template": "Generated: {when} UTC",
  "invoice_pdf_publisher_template": "Publisher: {publisher}",
  "invoice_pdf_currency_template": "Currency: {currency}",
  "invoice_pdf_table_header": "Campaign | Status | Impressions | Clicks | CTR",
  "invoice_pdf_table_rule": "----------------------------------------------",
  "invoice_pdf_line_template": "{title} | {status} | {impressions} | {clicks} | {ctr}%",
  "invoice_pdf_totals_template": "Totals: impressions={impressions} clicks={clicks} CTR={ctr}%",
  "invoice_pdf_settle_blurb": "Amounts settle via platform wallet per your region.",
  "err_invoice_list_failed": "Unable to build invoice",
  "err_invoice_currency_unavailable": "Currency config unavailable",
  "err_invoice_pdf_unavailable": "Invoice PDF unavailable"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
