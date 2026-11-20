-- Scrub Unicode dashes (figure/en/em/horizontal) to ASCII hyphen-minus across
-- all public text/jsonb columns. Also force vote_score_separator to ASCII "-".
-- Idempotent. Safe on already-clean databases.

DO $$
DECLARE
  r RECORD;
  q text;
BEGIN
  FOR r IN
    SELECT c.table_schema, c.table_name, c.column_name, c.data_type
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.data_type IN ('text', 'character varying', 'character', 'json', 'jsonb', 'citext')
  LOOP
    IF r.data_type = 'jsonb' THEN
      q := format(
        'UPDATE %I.%I SET %I = replace(replace(replace(replace(%I::text,
           E''\u2014'', ''-''), E''\u2013'', ''-''), E''\u2012'', ''-''), E''\u2015'', ''-'')::jsonb
         WHERE %I::text ~ E''[\u2012\u2013\u2014\u2015]''',
        r.table_schema, r.table_name, r.column_name, r.column_name, r.column_name
      );
    ELSIF r.data_type = 'json' THEN
      q := format(
        'UPDATE %I.%I SET %I = replace(replace(replace(replace(%I::text,
           E''\u2014'', ''-''), E''\u2013'', ''-''), E''\u2012'', ''-''), E''\u2015'', ''-'')::json
         WHERE %I::text ~ E''[\u2012\u2013\u2014\u2015]''',
        r.table_schema, r.table_name, r.column_name, r.column_name, r.column_name
      );
    ELSE
      q := format(
        'UPDATE %I.%I SET %I = replace(replace(replace(replace(%I,
           E''\u2014'', ''-''), E''\u2013'', ''-''), E''\u2012'', ''-''), E''\u2015'', ''-'')
         WHERE %I ~ E''[\u2012\u2013\u2014\u2015]''',
        r.table_schema, r.table_name, r.column_name, r.column_name, r.column_name
      );
    END IF;
    BEGIN
      EXECUTE q;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object('vote_score_separator', '-'),
    updated_at = NOW()
WHERE key IN ('play_rail_chrome', 'spectate_chrome');
