ALTER TABLE bookpi_events ADD COLUMN IF NOT EXISTS canonical TEXT;

UPDATE bookpi_events SET canonical = NULL WHERE canonical IS NULL;

CREATE OR REPLACE FUNCTION bookpi_validate_chain(expected_integrity_seed TEXT)
RETURNS TABLE(valid boolean, checked_events bigint)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  prior TEXT := repeat('0', 64);
  ev RECORD;
  bad INTEGER := 0;
  total BIGINT := 0;
BEGIN
  IF expected_integrity_seed IS NULL OR length(expected_integrity_seed) < 32 THEN
    RAISE EXCEPTION 'BOOKPI: integrity secret must be supplied externally';
  END IF;
  FOR ev IN SELECT * FROM bookpi_events ORDER BY sequence ASC LOOP
    total := total + 1;
    IF ev.canonical IS NULL OR ev.prev_hash <> prior OR encode(digest(ev.canonical, 'sha256'), 'hex') <> ev.hash THEN
      bad := bad + 1;
    END IF;
    IF encode(digest(expected_integrity_seed || ':' || ev.hash, 'sha3-512'), 'hex') <> ev.integrity THEN
      bad := bad + 1;
    END IF;
    prior := ev.hash;
  END LOOP;
  RETURN QUERY SELECT (bad = 0), total;
END;
$$;

CREATE OR REPLACE FUNCTION bookpi_require_canonical_on_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.canonical IS NULL OR length(NEW.canonical) = 0 THEN
    RAISE EXCEPTION 'BOOKPI: canonical event core is mandatory for new events';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookpi_require_canonical ON bookpi_events;
CREATE TRIGGER trg_bookpi_require_canonical
BEFORE INSERT ON bookpi_events
FOR EACH ROW EXECUTE FUNCTION bookpi_require_canonical_on_insert();

-- Runtime sessions must identify the actor that owns each evidence record.
ALTER TABLE bookpi_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookpi_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bookpi_actor_read ON bookpi_events;
DROP POLICY IF EXISTS bookpi_actor_append ON bookpi_events;
CREATE POLICY bookpi_actor_read ON bookpi_events
  FOR SELECT USING (actor_id = current_setting('app.actor_id', true));
CREATE POLICY bookpi_actor_append ON bookpi_events
  FOR INSERT WITH CHECK (actor_id = current_setting('app.actor_id', true));
