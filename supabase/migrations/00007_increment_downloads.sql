-- Fix: Download increment fails for non-owners due to UPDATE RLS policy
-- Solution: SECURITY DEFINER function callable via RPC, with atomic increment

CREATE OR REPLACE FUNCTION public.increment_downloads(p_owner TEXT, p_name TEXT)
RETURNS VOID AS $$
BEGIN
  -- Require authentication to prevent anonymous count inflation
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.skills
  SET downloads = downloads + 1
  WHERE name = p_name
    AND (
      owner_id IN (SELECT id FROM public.users WHERE username = p_owner)
      OR owner_org_id IN (SELECT id FROM public.organizations WHERE slug = p_owner)
    )
    AND (
      visibility = 'public'
      OR owner_id = auth.uid()
      OR (visibility = 'org' AND owner_org_id IS NOT NULL AND public.is_org_member(owner_org_id, auth.uid()))
      OR (visibility = 'team' AND team_id IS NOT NULL AND public.is_team_member(team_id, auth.uid()))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Explicitly block direct inserts into users table (created via auth trigger only)
CREATE POLICY "Users created via auth trigger only"
  ON public.users FOR INSERT
  WITH CHECK (false);
