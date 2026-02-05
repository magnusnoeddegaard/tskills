-- tskills Registry Rate Limiting
-- This migration adds rate limiting functionality to prevent API abuse

-- ============================================
-- RATE LIMITS TRACKING TABLE
-- ============================================

-- Table to track request counts per user/IP per action
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier TEXT NOT NULL,              -- User ID or IP address
  action TEXT NOT NULL,                  -- 'api' or 'publish'
  window_start TIMESTAMPTZ NOT NULL,     -- Start of the rate limit window
  request_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Unique constraint: one record per identifier/action/window
  UNIQUE(identifier, action, window_start)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
  ON public.rate_limits(identifier, action, window_start);

-- Index for cleanup of old records
CREATE INDEX IF NOT EXISTS idx_rate_limits_created_at
  ON public.rate_limits(created_at);

-- ============================================
-- RATE LIMIT CONFIGURATION TABLE
-- ============================================

-- Configuration table for rate limits
CREATE TABLE IF NOT EXISTS public.rate_limit_config (
  action TEXT PRIMARY KEY,
  window_seconds INTEGER NOT NULL,
  anonymous_limit INTEGER NOT NULL,
  authenticated_limit INTEGER NOT NULL
);

-- Insert default rate limits
-- Anonymous: 60 requests/hour for API, not allowed for publish
-- Authenticated: 1000 requests/hour for API, 30/hour for publish
INSERT INTO public.rate_limit_config (action, window_seconds, anonymous_limit, authenticated_limit) VALUES
  ('api', 3600, 60, 1000),       -- API: 60/hour anonymous, 1000/hour authenticated
  ('publish', 3600, 0, 30)       -- Publish: authenticated only, 30/hour
ON CONFLICT (action) DO UPDATE SET
  window_seconds = EXCLUDED.window_seconds,
  anonymous_limit = EXCLUDED.anonymous_limit,
  authenticated_limit = EXCLUDED.authenticated_limit;

-- ============================================
-- RATE LIMIT CHECK FUNCTION
-- ============================================

-- Function to check and increment rate limit
-- Returns JSON: { allowed: boolean, limit: int, remaining: int, reset_at: timestamp, retry_after?: int, error?: string }
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier TEXT,
  p_action TEXT,
  p_is_authenticated BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config public.rate_limit_config;
  v_window_start TIMESTAMPTZ;
  v_current_count INTEGER;
  v_limit INTEGER;
  v_reset_at TIMESTAMPTZ;
BEGIN
  -- Get rate limit configuration for this action
  SELECT * INTO v_config
  FROM public.rate_limit_config
  WHERE action = p_action;

  -- If no config found, allow the request (no rate limit for this action)
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'limit', NULL,
      'remaining', NULL,
      'reset_at', NULL
    );
  END IF;

  -- Determine the limit based on authentication status
  v_limit := CASE
    WHEN p_is_authenticated THEN v_config.authenticated_limit
    ELSE v_config.anonymous_limit
  END;

  -- If limit is 0, action is not allowed for this type of user
  IF v_limit = 0 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'limit', 0,
      'remaining', 0,
      'reset_at', NOW() + INTERVAL '1 hour',
      'retry_after', 3600,
      'error', 'This action requires authentication'
    );
  END IF;

  -- Calculate the start of the current window (truncate to hour)
  v_window_start := date_trunc('hour', NOW());
  v_reset_at := v_window_start + (v_config.window_seconds || ' seconds')::INTERVAL;

  -- Try to insert a new record or increment existing count
  INSERT INTO public.rate_limits (identifier, action, window_start, request_count)
  VALUES (p_identifier, p_action, v_window_start, 1)
  ON CONFLICT (identifier, action, window_start)
  DO UPDATE SET request_count = public.rate_limits.request_count + 1
  RETURNING request_count INTO v_current_count;

  -- Check if limit exceeded
  IF v_current_count > v_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'limit', v_limit,
      'remaining', 0,
      'reset_at', v_reset_at,
      'retry_after', EXTRACT(EPOCH FROM (v_reset_at - NOW()))::INTEGER
    );
  END IF;

  -- Request allowed
  RETURN jsonb_build_object(
    'allowed', true,
    'limit', v_limit,
    'remaining', v_limit - v_current_count,
    'reset_at', v_reset_at
  );
END;
$$;

-- ============================================
-- CLEANUP FUNCTION
-- ============================================

-- Function to clean up old rate limit records (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete records older than 2 hours (window is 1 hour, extra buffer for safety)
  DELETE FROM public.rate_limits
  WHERE created_at < NOW() - INTERVAL '2 hours';
END;
$$;

-- ============================================
-- PERMISSIONS
-- ============================================

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, BOOLEAN) TO authenticated, anon;

-- Rate limits table uses RLS but only accessed through security definer functions
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- No direct access policies - all access through security definer functions
-- This prevents users from manipulating their own rate limit records

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE public.rate_limits IS 'Tracks API request counts for rate limiting';
COMMENT ON TABLE public.rate_limit_config IS 'Configuration for rate limits per action type';
COMMENT ON FUNCTION public.check_rate_limit(TEXT, TEXT, BOOLEAN) IS 'Check and increment rate limit for a request. Returns JSON with allowed status and remaining quota.';
COMMENT ON FUNCTION public.cleanup_rate_limits() IS 'Clean up expired rate limit records. Should be run periodically (e.g., every hour via cron).';
