-- Label/value joiners, amount/currency joiners, piece glyphs, ads count parens.

UPDATE platform_settings
SET value = value || '{
  "label_value_separator": ": ",
  "id_truncate_suffix": "…",
  "piece_count_separator": " ",
  "glyph_king": "K",
  "glyph_man": "o"
}'::jsonb,
updated_at = NOW()
WHERE key = 'play_chrome';

UPDATE platform_settings
SET value = value || '{
  "glyph_king": "K",
  "glyph_man": "o"
}'::jsonb,
updated_at = NOW()
WHERE key = 'spectate_chrome';

UPDATE platform_settings
SET value = value || '{
  "label_value_separator": ": ",
  "flag_code_separator": " ",
  "rank_parts_separator": " "
}'::jsonb,
updated_at = NOW()
WHERE key = 'profile_inspect_chrome';

UPDATE platform_settings
SET value = value || '{
  "amount_currency_separator": " "
}'::jsonb,
updated_at = NOW()
WHERE key = 'wallet_chrome';

UPDATE platform_settings
SET value = value || '{
  "amount_currency_separator": " ",
  "free_entry_amount": "0"
}'::jsonb,
updated_at = NOW()
WHERE key = 'tournament_chrome';

UPDATE platform_settings
SET value = value || '{
  "amount_currency_separator": " "
}'::jsonb,
updated_at = NOW()
WHERE key = 'tournaments_player_chrome';

UPDATE platform_settings
SET value = value || '{
  "paren_open": " (",
  "paren_close": ")"
}'::jsonb,
updated_at = NOW()
WHERE key = 'ad_runtime_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || '{
    "amount_currency_separator": " ",
    "list_join_separator": ", "
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{feature_flags}',
  COALESCE(value->'feature_flags', '{}'::jsonb) || '{
    "list_join_separator": ", "
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{telemetry}',
  COALESCE(value->'telemetry', '{}'::jsonb) || '{
    "actor_action_separator": "/"
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{dashboard}',
  COALESCE(value->'dashboard', '{}'::jsonb) || '{
    "signed_in_joiner": " ",
    "signed_in_suffix": "."
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{media_pool}',
  COALESCE(value->'media_pool', '{}'::jsonb) || '{
    "channel_meta_space": " "
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
