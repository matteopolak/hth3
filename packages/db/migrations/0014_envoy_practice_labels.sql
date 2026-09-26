-- Rename the practice organization and catalogue records without changing their
-- sample flags, verification state, or lack of government affiliation.
UPDATE organizations
SET display_name = 'Envoy Staff Workspace'
WHERE id = 'org_43G1B1RhPwac7EjS' AND sample = 1;

UPDATE taxonomy_departments
SET name_en = 'Envoy general review', name_fr = 'Examen général Envoy'
WHERE id = 'general_review' AND organization_id = 'org_43G1B1RhPwac7EjS';

UPDATE source_registry
SET name = 'Envoy community resources',
    publisher = 'Envoy',
    sample_label = 'Practice catalogue; unaffiliated with the City of Toronto'
WHERE id = 'fictional-toronto-sample' AND origin = 'sample';

UPDATE source_records
SET title = 'Neighbourhood resource information session',
    summary = 'Use this practice listing to explore community resources and prepare questions.',
    publisher = 'Envoy',
    sample_label = 'Practice record; no event is scheduled and no City of Toronto affiliation.'
WHERE id = 'sample-toronto-community-resource' AND origin = 'sample';
