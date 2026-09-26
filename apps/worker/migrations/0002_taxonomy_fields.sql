ALTER TABLE categories ADD COLUMN examples TEXT NOT NULL DEFAULT '[]';
ALTER TABLE categories ADD COLUMN exclusions TEXT NOT NULL DEFAULT '[]';
ALTER TABLE categories ADD COLUMN required_fields TEXT NOT NULL DEFAULT '["location"]';
ALTER TABLE taxonomy_drafts ADD COLUMN examples TEXT NOT NULL DEFAULT '[]';
ALTER TABLE taxonomy_drafts ADD COLUMN exclusions TEXT NOT NULL DEFAULT '[]';
ALTER TABLE taxonomy_drafts ADD COLUMN required_fields TEXT NOT NULL DEFAULT '["location"]';
