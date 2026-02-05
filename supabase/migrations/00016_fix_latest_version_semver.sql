-- Fix semver sorting to correctly handle numeric pre-release identifiers,
-- and add a DELETE trigger so latest_version is recalculated when versions
-- are removed (e.g., retracting a bad publish).
--
-- Previous issues:
-- - 00012 crashed on pre-release versions ("0-beta" can't cast to int)
-- - 00014 fixed the crash but sorts pre-release identifiers alphabetically,
--   so "1.0.0-11" incorrectly sorts below "1.0.0-2"
-- - No DELETE trigger existed, so removing a version left latest_version stale

-- ============================================
-- SEMVER SORT KEY FUNCTION
-- ============================================

-- Returns a TEXT[] that sorts correctly for any semver string.
-- Handles: major.minor.patch, pre-release identifiers, build metadata.
-- Per semver spec:
--   - Numeric identifiers compare numerically (2 < 11)
--   - Alphanumeric identifiers compare lexically
--   - Numeric identifiers have lower precedence than alphanumeric
--   - Release versions rank above pre-release of the same numeric version
CREATE OR REPLACE FUNCTION public.semver_sort_key(p_version TEXT)
RETURNS TEXT[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_core TEXT;
  v_prerelease TEXT;
  v_parts TEXT[];
  v_result TEXT[];
  v_ident TEXT;
BEGIN
  -- Strip build metadata (everything after +)
  v_core := split_part(p_version, '+', 1);

  -- Separate core version from pre-release
  IF position('-' in v_core) > 0 THEN
    v_prerelease := substring(v_core from position('-' in v_core) + 1);
    v_core := split_part(v_core, '-', 1);
  END IF;

  -- Parse major.minor.patch into zero-padded strings for numeric sort
  v_parts := string_to_array(v_core, '.');
  v_result := ARRAY[
    lpad(COALESCE(v_parts[1], '0'), 10, '0'),
    lpad(COALESCE(v_parts[2], '0'), 10, '0'),
    lpad(COALESCE(v_parts[3], '0'), 10, '0')
  ];

  IF v_prerelease IS NOT NULL THEN
    -- Pre-release: marker '0' sorts below release marker '1'
    v_result := v_result || ARRAY['0'];
    -- Process each dot-separated pre-release identifier
    FOREACH v_ident IN ARRAY string_to_array(v_prerelease, '.')
    LOOP
      IF v_ident ~ '^\d+$' THEN
        -- Numeric: prefix '0' + zero-padded (numeric < alphanumeric per semver)
        v_result := v_result || ARRAY['0' || lpad(v_ident, 10, '0')];
      ELSE
        -- Alphanumeric: prefix '1' (sorts after numeric per semver)
        v_result := v_result || ARRAY['1' || v_ident];
      END IF;
    END LOOP;
  ELSE
    -- Release version: marker '1' sorts above pre-release marker '0'
    v_result := v_result || ARRAY['1'];
  END IF;

  RETURN v_result;
END;
$$;

-- ============================================
-- UPDATED TRIGGER FUNCTION
-- ============================================

-- Handles both INSERT and DELETE on skill_versions
CREATE OR REPLACE FUNCTION public.update_skill_latest_version()
RETURNS TRIGGER AS $$
DECLARE
  v_skill_id UUID;
BEGIN
  -- Use NEW for INSERT, OLD for DELETE
  IF TG_OP = 'DELETE' THEN
    v_skill_id := OLD.skill_id;
  ELSE
    v_skill_id := NEW.skill_id;
  END IF;

  UPDATE public.skills
  SET latest_version = (
    SELECT version
    FROM public.skill_versions
    WHERE skill_id = v_skill_id
    ORDER BY public.semver_sort_key(version) DESC
    LIMIT 1
  )
  WHERE id = v_skill_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ADD DELETE TRIGGER
-- ============================================

-- INSERT trigger already exists from 00012 and still works (same function name)
DROP TRIGGER IF EXISTS update_latest_version_on_delete ON public.skill_versions;
CREATE TRIGGER update_latest_version_on_delete
  AFTER DELETE ON public.skill_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_skill_latest_version();
