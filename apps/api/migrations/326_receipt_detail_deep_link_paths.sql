-- Trim-parity: admin receipt notification deep-links to receipts list (hub forwards ?receipt= to detail).
UPDATE notification_kinds
SET href_path = '/payments/receipts', href_query_key = 'receipt'
WHERE code = 'admin.receipt_pending';
