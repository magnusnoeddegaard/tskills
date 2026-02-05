-- Tighten name and slug validation:
-- 1. Add length limits (prevent single-char org slugs or absurdly long names)
-- 2. Disallow trailing hyphens (e.g., "my-skill-")
-- 3. Disallow consecutive hyphens (e.g., "my--skill")
--
-- Pattern explanation: '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'
--   - Must start with a letter
--   - Followed by optional alphanumeric chars
--   - Hyphen-separated segments must each have at least one alphanumeric char
--   - No trailing hyphens, no consecutive hyphens

-- ============================================
-- SKILLS: owner (username — can start with digit)
-- ============================================

ALTER TABLE public.skills DROP CONSTRAINT IF EXISTS skills_owner_check;
ALTER TABLE public.skills ADD CONSTRAINT skills_owner_check
  CHECK (
    owner ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    AND char_length(owner) BETWEEN 1 AND 64
  );

-- ============================================
-- SKILLS: name
-- ============================================

ALTER TABLE public.skills DROP CONSTRAINT IF EXISTS skills_name_check;
ALTER TABLE public.skills ADD CONSTRAINT skills_name_check
  CHECK (
    name ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'
    AND char_length(name) BETWEEN 2 AND 64
  );

-- ============================================
-- ORGANIZATIONS: slug
-- ============================================

ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_slug_check;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_slug_check
  CHECK (
    slug ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'
    AND char_length(slug) BETWEEN 2 AND 64
  );

-- ============================================
-- TEAMS: slug
-- ============================================

ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_slug_check;
ALTER TABLE public.teams ADD CONSTRAINT teams_slug_check
  CHECK (
    slug ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'
    AND char_length(slug) BETWEEN 2 AND 64
  );
