-- FMJD International Draughts board parameters (clients hydrate from this row; no client hardcodes).
INSERT INTO platform_settings (key, value) VALUES
  ('board_rules', '{"size":10,"pieces_per_side":20,"setup_rows":4,"variant":"fmjd_international"}'::jsonb)
ON CONFLICT (key) DO NOTHING;
