-- Remove silent USD column defaults. Callers must supply currency from
-- platform_settings + geo routing (global USD / Ethiopia ETB from DB row).
ALTER TABLE tournaments ALTER COLUMN entry_fee_currency DROP DEFAULT;
ALTER TABLE wallets ALTER COLUMN currency DROP DEFAULT;
ALTER TABLE payment_accounts ALTER COLUMN currency DROP DEFAULT;
ALTER TABLE tournament_entries ALTER COLUMN currency DROP DEFAULT;
