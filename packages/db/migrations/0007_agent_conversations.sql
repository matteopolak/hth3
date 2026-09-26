CREATE TABLE agent_conversations (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('resident', 'employee')),
  locale TEXT NOT NULL CHECK (locale IN ('en', 'fr')),
  owner_subject TEXT,
  guest_token_hash TEXT UNIQUE,
  organization_id TEXT REFERENCES organizations(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX agent_conversations_owner_idx
  ON agent_conversations (owner_subject, updated_at DESC);

CREATE TABLE agent_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  tool_name TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX agent_messages_conversation_idx
  ON agent_messages (conversation_id, created_at, id);

CREATE TABLE agent_proposals (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  args_json TEXT NOT NULL,
  preview_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  result_json TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  decided_at TEXT
);

CREATE INDEX agent_proposals_conversation_idx
  ON agent_proposals (conversation_id, status, created_at DESC);

CREATE TABLE agent_ai_daily_usage (
  usage_day TEXT PRIMARY KEY,
  inference_count INTEGER NOT NULL CHECK (inference_count >= 0)
);
