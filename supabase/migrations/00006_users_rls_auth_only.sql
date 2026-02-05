-- Fix: Require authentication to read users table
-- Previously anyone could read all user data including emails
--
-- This migration addresses a privacy concern where the users table
-- (containing emails) was readable by anonymous users.

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users are viewable by everyone" ON public.users;

-- Users can always read their own complete record
CREATE POLICY "Users can read own record"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Authenticated users can read other users (needed for invite flows)
-- Trade-off: authenticated users can see emails, similar to GitHub
CREATE POLICY "Authenticated users can read other users"
  ON public.users FOR SELECT
  USING (auth.uid() IS NOT NULL);
