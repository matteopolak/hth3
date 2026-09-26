-- Keep the seeded organization and posting plainly worded. The sample flag,
-- unverified organization state, and UI practice disclosure remain authoritative.
UPDATE organizations
SET display_name = 'CivicResolve Community Services'
WHERE id = 'org_43G1B1RhPwac7EjS' AND sample = 1;

UPDATE postings
SET title = 'Civic Services Intake Assistant',
    description = 'Help residents find appropriate services and keep intake records organized.',
    location_name = 'Toronto, Ontario'
WHERE id = 'sample-posting-intake-assistant' AND sample = 1;
