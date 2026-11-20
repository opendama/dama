-- Replace Unicode dashes with ASCII hyphen-minus (U+002D) in all public text/json columns:
-- U+2012 FIGURE DASH, U+2013 EN DASH, U+2014 EM DASH, U+2015 HORIZONTAL BAR.
-- Idempotent. Reports rows updated per column.

DO $$
DECLARE
  r RECORD;
  q text;
  updated bigint;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS em_dash_fixes (
    table_name text NOT NULL,
    column_name text NOT NULL,
    data_type text NOT NULL,
    rows_updated bigint NOT NULL
  ) ON COMMIT PRESERVE ROWS;
  DELETE FROM em_dash_fixes;

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
    IF r.data_type = 'jsonb' THEN
      -- Rewrite jsonb via text replace then cast back (preserves structure for typical chrome docs).
      q := format(
        'WITH touched AS (
           SELECT ctid FROM %I.%I WHERE %I::text ~ %L
         ), upd AS (
           UPDATE %I.%I AS t
           SET %I = replace(replace(replace(replace(%I::text,
             %L, %L), %L, %L), %L, %L), %L, %L)::jsonb
           FROM touched WHERE t.ctid = touched.ctid
           RETURNING 1
         )
         SELECT COUNT(*) FROM upd',
        r.table_schema, r.table_name, r.column_name, E'[\u2012\u2013\u2014\u2015]',
        r.table_schema, r.table_name,
        r.column_name, r.column_name,
        E'\u2014', '-', E'\u2013', '-', E'\u2012', '-', E'\u2015', '-'
      );
    ELSIF r.data_type = 'json' THEN
      q := format(
        'WITH touched AS (
           SELECT ctid FROM %I.%I WHERE %I::text ~ %L
         ), upd AS (
           UPDATE %I.%I AS t
           SET %I = replace(replace(replace(replace(%I::text,
             %L, %L), %L, %L), %L, %L), %L, %L)::json
           FROM touched WHERE t.ctid = touched.ctid
           RETURNING 1
         )
         SELECT COUNT(*) FROM upd',
        r.table_schema, r.table_name, r.column_name, E'[\u2012\u2013\u2014\u2015]',
        r.table_schema, r.table_name,
        r.column_name, r.column_name,
        E'\u2014', '-', E'\u2013', '-', E'\u2012', '-', E'\u2015', '-'
      );
    ELSE
      q := format(
        'WITH upd AS (
           UPDATE %I.%I
           SET %I = replace(replace(replace(replace(%I,
             %L, %L), %L, %L), %L, %L), %L, %L)
           WHERE %I ~ %L
           RETURNING 1
         )
         SELECT COUNT(*) FROM upd',
        r.table_schema, r.table_name,
        r.column_name, r.column_name,
        E'\u2014', '-', E'\u2013', '-', E'\u2012', '-', E'\u2015', '-',
        r.column_name, E'[\u2012\u2013\u2014\u2015]'
      );
    END IF;
    BEGIN
      EXECUTE q INTO updated;
      IF updated > 0 THEN
        INSERT INTO em_dash_fixes(table_name, column_name, data_type, rows_updated)
        VALUES (r.table_name, r.column_name, r.data_type, updated);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'skip %.%: %', r.table_name, r.column_name, SQLERRM;
    END;
  END LOOP;
END $$;

SELECT table_name, column_name, data_type, rows_updated
FROM em_dash_fixes
ORDER BY rows_updated DESC, table_name, column_name;

SELECT COALESCE(SUM(rows_updated), 0) AS total_rows_updated,
       COUNT(*) AS columns_updated
FROM em_dash_fixes;
