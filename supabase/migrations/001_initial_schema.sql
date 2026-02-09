-- VatmanPro Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  tags TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Canvas table (stores React Flow state)
CREATE TABLE IF NOT EXISTS canvases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  canvas_data JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}',
  original_canvas JSONB, -- Original JSON Canvas from Obsidian
  view_mode TEXT DEFAULT 'technical' CHECK (view_mode IN ('technical', 'executive')),
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Node documentation table
CREATE TABLE IF NOT EXISTS node_documentation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  canvas_id UUID NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL, -- ID of the node in React Flow
  title TEXT NOT NULL,
  content TEXT, -- Markdown content
  view_mode TEXT DEFAULT 'all' CHECK (view_mode IN ('technical', 'executive', 'all')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(canvas_id, node_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_public ON projects(is_public);
CREATE INDEX IF NOT EXISTS idx_canvases_project ON canvases(project_id);
CREATE INDEX IF NOT EXISTS idx_canvases_primary ON canvases(project_id, is_primary);
CREATE INDEX IF NOT EXISTS idx_canvas_data_gin ON canvases USING GIN (canvas_data);
CREATE INDEX IF NOT EXISTS idx_node_docs_canvas ON node_documentation(canvas_id);

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvases ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_documentation ENABLE ROW LEVEL SECURITY;

-- RLS Policies for public read access
CREATE POLICY "Public projects are viewable by everyone"
  ON projects FOR SELECT
  USING (is_public = true);

CREATE POLICY "Public canvases are viewable by everyone"
  ON canvases FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = canvases.project_id
    AND projects.is_public = true
  ));

CREATE POLICY "Public documentation is viewable by everyone"
  ON node_documentation FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM canvases
    JOIN projects ON projects.id = canvases.project_id
    WHERE canvases.id = node_documentation.canvas_id
    AND projects.is_public = true
  ));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_canvases_updated_at
  BEFORE UPDATE ON canvases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_node_documentation_updated_at
  BEFORE UPDATE ON node_documentation
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Sample data (optional - remove in production)
INSERT INTO projects (name, slug, description, tags) VALUES
  ('B2B Trade Platform', 'b2b-trade-platform', 'International trade platform with 7-step constructor and 120+ API endpoints.', ARRAY['Next.js', 'Supabase', 'React Flow']),
  ('Database Schema', 'database-schema', 'Supabase database architecture with 15+ tables and RLS policies.', ARRAY['PostgreSQL', 'Supabase', 'RLS']),
  ('State Management', 'state-management', 'React state architecture using Context API and TanStack Query.', ARRAY['React', 'TanStack Query', 'Zustand']);
