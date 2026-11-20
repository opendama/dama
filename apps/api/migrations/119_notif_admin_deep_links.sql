-- Admin pending kinds: attach entity id so console can deep-open (Trim admin_nav_query parity).
UPDATE notification_kinds
SET href_path = '/payments', href_query_key = 'receipt'
WHERE code = 'admin.receipt_pending';

UPDATE notification_kinds
SET href_path = '/payments', href_query_key = 'payout'
WHERE code = 'admin.payout_pending';

UPDATE notification_kinds
SET href_path = '/payments', href_query_key = 'kyc'
WHERE code = 'admin.kyc_pending';

UPDATE notification_kinds
SET href_path = '/avatars', href_query_key = 'user'
WHERE code = 'admin.avatar_pending';
