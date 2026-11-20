-- Player payout history deep-link: open wallet history row (?id=), not transactions ledger.
-- focus=payout still targets the request form; id targets history (API seek + client highlight).

UPDATE notification_kinds
SET href_path = '/wallet',
    href_query_key = 'id'
WHERE code = 'player.payout_updated';
