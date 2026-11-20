-- Scan all public base-table text/json columns for Unicode dash characters:
-- U+2014 EM DASH, U+2013 EN DASH, U+2012 FIGURE DASH, U+2015 HORIZONTAL BAR.
-- Reports schema.table.column and hit counts (does not mutate).

DO $$
DECLARE
  r RECORD;
  q text;
  cnt bigint;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS em_dash_hits (
    table_name text NOT NULL,
    column_name text NOT NULL,
    data_type text NOT NULL,
    hit_count bigint NOT NULL
  ) ON COMMIT PRESERVE ROWS;
  DELETE FROM em_dash_hits;

  FOR r IN
    SELECT c.table_schema, c.table_name, c.column_name, c.data_type
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.data_type IN ('text', 'character varying', 'character', 'json', 'jsonb', 'citext')
    ORDER BY c.table_name, c.ordinal_position
  LOOP
    IF r.data_type IN ('json', 'jsonb') THEN
      q := format(
        'SELECT COUNT(*) FROM %I.%I WHERE %I::text ~ %L',
        r.table_schema, r.table_name, r.column_name,
        E'[\u2012\u2013\u2014\u2015]'
      );
    ELSE
      q := format(
        'SELECT COUNT(*) FROM %I.%I WHERE %I::text ~ %L',
        r.table_schema, r.table_name, r.column_name,
        E'[\u2012\u2013\u2014\u2015]'
      );
    END IF;
    BEGIN
      EXECUTE q INTO cnt;
      IF cnt > 0 THEN
        INSERT INTO em_dash_hits(table_name, column_name, data_type, hit_count)
        VALUES (r.table_name, r.column_name, r.data_type, cnt);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Skip unreadable columns (e.g. permissions); continue scan.
      NULL;
    END;
  END LOOP;
END $$;

SELECT table_name, column_name, data_type, hit_count
FROM em_dash_hits
ORDER BY hit_count DESC, table_name, column_name;

SELECT COALESCE(SUM(hit_count), 0) AS total_hits,
       COUNT(*) AS columns_with_hits
FROM em_dash_hits;
