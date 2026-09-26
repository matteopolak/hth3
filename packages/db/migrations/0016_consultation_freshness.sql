PRAGMA foreign_keys = ON;

-- The original review was a manual page check. The scheduled Worker has not
-- successfully verified this Canada.ca page, so it must not remain current.
UPDATE source_registry
SET freshness_state = 'stale', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'federal-consultations-finder' AND freshness_state = 'current';

UPDATE source_records
SET freshness_state = 'stale', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'official-federal-consultations-finder' AND freshness_state = 'current';
