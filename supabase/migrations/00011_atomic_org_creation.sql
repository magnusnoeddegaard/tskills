-- Atomic org creation with owner membership
-- Prevents orphaned orgs if the owner membership insert fails.
-- Also solves the RLS chicken-and-egg problem: the org_members INSERT policy
-- requires can_manage_org(), but the creator isn't a member yet.

CREATE OR REPLACE FUNCTION public.create_org_with_owner(
  p_slug text,
  p_name text,
  p_description text DEFAULT ''
)
RETURNS json AS $$
DECLARE
  v_org public.organizations;
BEGIN
  -- Create the organization
  INSERT INTO public.organizations (slug, name, description, created_by)
  VALUES (p_slug, p_name, p_description, auth.uid())
  RETURNING * INTO v_org;

  -- Add creator as owner
  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (v_org.id, auth.uid(), 'owner');

  -- Return the created org as JSON
  RETURN row_to_json(v_org);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only authenticated users can create organizations
REVOKE EXECUTE ON FUNCTION public.create_org_with_owner(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_org_with_owner(text, text, text) TO authenticated;
