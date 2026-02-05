-- Add deprecation support to skills table
-- This migration adds columns to mark skills as deprecated with an optional message

-- Add deprecation fields if they don't exist
ALTER TABLE public.skills
ADD COLUMN IF NOT EXISTS deprecated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deprecation_message TEXT;

-- Create index for filtering deprecated skills
CREATE INDEX IF NOT EXISTS idx_skills_deprecated ON public.skills(deprecated);

-- Comment on columns
COMMENT ON COLUMN public.skills.deprecated IS 'Whether this skill is deprecated';
COMMENT ON COLUMN public.skills.deprecation_message IS 'Optional message explaining deprecation, e.g., replacement skill';
