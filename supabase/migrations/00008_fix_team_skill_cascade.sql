-- Fix: When a team is deleted, skills with team visibility lose their team_id
-- (ON DELETE SET NULL), which violates the skills_team_visibility CHECK constraint.
-- This trigger automatically changes visibility from 'team' to 'org' when team_id
-- is set to NULL, preserving the skills instead of causing a constraint error.

CREATE OR REPLACE FUNCTION public.fix_team_skill_visibility()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.team_id IS NULL AND NEW.visibility = 'team' THEN
    NEW.visibility := 'org';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fix_team_skill_visibility_trigger
  BEFORE UPDATE ON public.skills
  FOR EACH ROW
  WHEN (OLD.team_id IS NOT NULL AND NEW.team_id IS NULL)
  EXECUTE FUNCTION public.fix_team_skill_visibility();
