CREATE TABLE IF NOT EXISTS voice_sessions (
  conversation_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  case_id TEXT,
  transcript TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS voice_sessions_case ON voice_sessions (case_id);
