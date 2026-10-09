ALTER TABLE messages ADD COLUMN IF NOT EXISTS ai_analysis TEXT;
CREATE INDEX IF NOT EXISTS idx_messages_ai_analysis
  ON messages (id)
  WHERE is_evolution = TRUE AND media_kind = 'image' AND media_path IS NOT NULL;
