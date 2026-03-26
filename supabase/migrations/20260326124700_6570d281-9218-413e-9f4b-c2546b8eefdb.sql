
-- Fix: drop only legacy UNIQUE indexes, excluding PK and the target dedup_key
DO $$
DECLARE
  _idx_name text;
BEGIN
  FOR _idx_name IN
    SELECT idx.indexname
    FROM pg_indexes idx
    JOIN pg_class ic ON ic.relname = idx.indexname AND ic.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LEFT JOIN pg_constraint con ON con.conindid = ic.oid
    WHERE idx.schemaname = 'public'
      AND idx.tablename = 'demographic_zones'
      AND idx.indexdef ILIKE '%UNIQUE%'
      AND idx.indexname != 'demographic_zones_dedup_key'
      AND (con.contype IS NULL OR con.contype = 'u')  -- exclude PK constraints (contype='p')
  LOOP
    BEGIN
      EXECUTE format('DROP INDEX IF EXISTS public.%I', _idx_name);
      RAISE NOTICE 'Dropped legacy unique index: %', _idx_name;
    EXCEPTION WHEN dependent_objects_still_exist THEN
      RAISE NOTICE 'Skipped index % (has dependents)', _idx_name;
    END;
  END LOOP;
END $$;
