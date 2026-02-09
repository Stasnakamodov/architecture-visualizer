-- Add presentations column to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS presentations JSONB DEFAULT '[]';

-- Create public_presentations table for shareable links
CREATE TABLE IF NOT EXISTS public_presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  presentation_id TEXT NOT NULL,
  slug UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index on slug for fast lookups
CREATE INDEX IF NOT EXISTS idx_public_presentations_slug ON public_presentations(slug);

-- RLS: public read when is_active = true
ALTER TABLE public_presentations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public presentations are viewable by everyone"
  ON public_presentations
  FOR SELECT
  USING (is_active = true);

-- Trigger for updated_at
CREATE TRIGGER update_public_presentations_updated_at
  BEFORE UPDATE ON public_presentations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
