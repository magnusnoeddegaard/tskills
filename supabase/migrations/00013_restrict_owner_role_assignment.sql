-- Fix: Admins can escalate to owner role via org add/update
-- Only org owners should be able to assign or modify the 'owner' role.
-- Admins can only assign 'member' or 'admin' roles.

-- ============================================
-- FIX ORG_MEMBERS INSERT POLICY
-- ============================================

DROP POLICY IF EXISTS "Org owners/admins can add members" ON public.org_members;

CREATE POLICY "Org managers can add members with role restrictions"
  ON public.org_members FOR INSERT
  WITH CHECK (
    -- Admins can add members with 'member' or 'admin' role
    (
      public.can_manage_org(org_id, auth.uid())
      AND role IN ('member', 'admin')
    )
    -- Only owners can assign the 'owner' role
    OR (
      public.get_org_role(org_id, auth.uid()) = 'owner'
      AND role = 'owner'
    )
  );

-- ============================================
-- FIX ORG_MEMBERS UPDATE POLICY
-- ============================================

DROP POLICY IF EXISTS "Org owners/admins can update member roles" ON public.org_members;

CREATE POLICY "Org managers can update members with role restrictions"
  ON public.org_members FOR UPDATE
  USING (
    -- Owners can update any member record
    public.get_org_role(org_id, auth.uid()) = 'owner'
    -- Admins can only update non-owner records
    OR (
      public.can_manage_org(org_id, auth.uid())
      AND role != 'owner'
    )
  )
  WITH CHECK (
    -- Admins can set role to 'member' or 'admin'
    (
      public.can_manage_org(org_id, auth.uid())
      AND role IN ('member', 'admin')
    )
    -- Only owners can set role to 'owner'
    OR (
      public.get_org_role(org_id, auth.uid()) = 'owner'
      AND role = 'owner'
    )
  );

-- ============================================
-- FIX ORG_MEMBERS DELETE POLICY
-- ============================================
-- Admins should not be able to remove owners from the org.

DROP POLICY IF EXISTS "Org owners/admins can remove members" ON public.org_members;

CREATE POLICY "Org managers can remove members with restrictions"
  ON public.org_members FOR DELETE
  USING (
    -- Owners can remove anyone
    public.get_org_role(org_id, auth.uid()) = 'owner'
    -- Admins can only remove non-owners
    OR (
      public.can_manage_org(org_id, auth.uid())
      AND role != 'owner'
    )
  );
