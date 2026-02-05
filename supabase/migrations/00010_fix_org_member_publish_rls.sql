-- Fix: RLS INSERT/UPDATE policies for skills and skill_versions use
-- can_manage_org() which only allows owner/admin roles. The PRD specifies
-- that regular org members should also be able to publish skills.
-- This changes those policies to use is_org_member() instead.

-- ============================================
-- FIX SKILLS INSERT POLICY
-- ============================================

DROP POLICY IF EXISTS "Users can insert skills" ON public.skills;

CREATE POLICY "Users can insert skills"
  ON public.skills FOR INSERT
  WITH CHECK (
    -- User can insert personal skills
    (owner_id = auth.uid() AND owner_org_id IS NULL)
    -- Any org member can insert org skills
    OR (owner_org_id IS NOT NULL AND public.is_org_member(owner_org_id, auth.uid()))
  );

-- ============================================
-- FIX SKILLS UPDATE POLICY
-- ============================================
-- publishSkill() also updates existing skills, so members need UPDATE access too.

DROP POLICY IF EXISTS "Users can update own or org skills" ON public.skills;

CREATE POLICY "Users can update own or org skills"
  ON public.skills FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR (owner_org_id IS NOT NULL AND public.is_org_member(owner_org_id, auth.uid()))
  );

-- ============================================
-- FIX SKILL VERSIONS INSERT POLICY
-- ============================================

DROP POLICY IF EXISTS "Users can insert versions for own or org skills" ON public.skill_versions;

CREATE POLICY "Users can insert versions for own or org skills"
  ON public.skill_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.skills s
      WHERE s.id = skill_versions.skill_id
      AND (
        s.owner_id = auth.uid()
        OR (s.owner_org_id IS NOT NULL AND public.is_org_member(s.owner_org_id, auth.uid()))
      )
    )
  );
