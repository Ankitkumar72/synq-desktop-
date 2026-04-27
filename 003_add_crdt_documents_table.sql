-- Add CRDT Documents Table for Yjs State Persistence
-- This table stores the binary state of Yjs documents (rich-text editor content)
-- for offline-first sync and conflict-free collaborative editing.

CREATE TABLE IF NOT EXISTS crdt_documents (
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state BIGINT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  
  PRIMARY KEY (entity_type, entity_id),
  
  CONSTRAINT fk_crdt_documents_user 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE crdt_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own CRDT documents
CREATE POLICY "Users can manage own CRDT documents"
  ON crdt_documents FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_crdt_documents_user_id 
  ON crdt_documents(user_id);

CREATE INDEX IF NOT EXISTS idx_crdt_documents_entity 
  ON crdt_documents(user_id, entity_type, entity_id);

-- Update REPLICA IDENTITY for Realtime
ALTER TABLE crdt_documents REPLICA IDENTITY FULL;

-- Add to Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE crdt_documents;

-- Auto-update updated_at column
CREATE TRIGGER set_updated_at_crdt_documents
  BEFORE UPDATE ON crdt_documents FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);
