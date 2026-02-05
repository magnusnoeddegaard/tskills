-- Add full-text search support for efficient skill discovery.
-- Without this, search relies on ILIKE which table-scans and gets slow at scale.
-- Adds weighted tsvector (name > description > tags) and trigram index for fuzzy matching.

-- ============================================
-- FULL-TEXT SEARCH VECTOR
-- ============================================

-- Add tsvector column (maintained by trigger, not generated column,
-- because to_tsvector is STABLE not IMMUTABLE)
ALTER TABLE public.skills
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Function to keep search_vector in sync
CREATE OR REPLACE FUNCTION public.update_skill_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_skills_search_vector
  BEFORE INSERT OR UPDATE OF name, description, tags ON public.skills
  FOR EACH ROW EXECUTE FUNCTION public.update_skill_search_vector();

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_skills_search_vector
  ON public.skills USING gin(search_vector);

-- ============================================
-- TRIGRAM INDEX FOR FUZZY MATCHING
-- ============================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram index on name for partial/fuzzy matching (e.g., typo-tolerant search)
CREATE INDEX IF NOT EXISTS idx_skills_name_trgm
  ON public.skills USING gin(name gin_trgm_ops);

-- ============================================
-- BACKFILL EXISTING ROWS
-- ============================================

-- Populate search_vector for skills that already exist.
-- The trigger handles all future inserts/updates automatically.
UPDATE public.skills
SET search_vector =
  setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'C')
WHERE search_vector IS NULL;
