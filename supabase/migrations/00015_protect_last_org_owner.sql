-- Prevent removing or demoting the last owner of an organization.
-- Without this protection, an org can become permanently unmanageable
-- (no one can add members, update settings, or delete the org).

-- ============================================
-- PREVENT DELETE OF LAST OWNER
-- ============================================

CREATE OR REPLACE FUNCTION public.prevent_last_owner_removal()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = OLD.org_id
      AND role = 'owner'
      AND user_id != OLD.user_id
  ) THEN
    RAISE EXCEPTION 'Cannot remove the last owner of an organization';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_last_owner_delete
  BEFORE DELETE ON public.org_members
  FOR EACH ROW
  WHEN (OLD.role = 'owner')
  EXECUTE FUNCTION public.prevent_last_owner_removal();

-- ============================================
-- PREVENT DEMOTION OF LAST OWNER
-- ============================================

CREATE OR REPLACE FUNCTION public.prevent_last_owner_demotion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role = 'owner' AND NEW.role != 'owner' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = OLD.org_id
        AND role = 'owner'
        AND user_id != OLD.user_id
    ) THEN
      RAISE EXCEPTION 'Cannot demote the last owner of an organization';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_last_owner_update
  BEFORE UPDATE ON public.org_members
  FOR EACH ROW
  WHEN (OLD.role = 'owner')
  EXECUTE FUNCTION public.prevent_last_owner_demotion();
