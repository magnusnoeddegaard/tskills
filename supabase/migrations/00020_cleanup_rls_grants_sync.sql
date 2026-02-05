-- Cleanup migration: fix redundant RLS, missing grants, and stale owner text.

-- ============================================
-- DROP REDUNDANT USERS RLS POLICY
-- ============================================

-- "Users can read own record" (auth.uid() = id) is a subset of
-- "Authenticated users can read other users" (auth.uid() IS NOT NULL).
-- The second policy already covers the first.
DROP POLICY IF EXISTS "Users can read own record" ON public.users;

-- ============================================
-- FIX INCREMENT_DOWNLOADS GRANTS
-- ============================================

-- Other security-definer functions (check_rate_limit, create_org_with_owner)
-- have explicit grants. increment_downloads was relying on the default PUBLIC
-- grant, which is inconsistent and overly permissive.
-- The function already silently returns for anonymous callers, but we should
-- enforce this at the permission level too.
REVOKE EXECUTE ON FUNCTION public.increment_downloads(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_downloads(TEXT, TEXT) TO authenticated;

-- ============================================
-- SYNC SKILLS.OWNER WHEN USERNAME CHANGES
-- ============================================

-- The skills.owner text column stores the username for quick lookups,
-- but nothing kept it in sync if a user changed their GitHub username.
-- This trigger propagates username changes to all owned skills.
CREATE OR REPLACE FUNCTION public.sync_skill_owner_username()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.skills
  SET owner = NEW.username
  WHERE owner_id = NEW.id
    AND owner != NEW.username;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER sync_skill_owner_on_username_change
  AFTER UPDATE OF username ON public.users
  FOR EACH ROW
  WHEN (OLD.username IS DISTINCT FROM NEW.username)
  EXECUTE FUNCTION public.sync_skill_owner_username();
