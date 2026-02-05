-- Fix: cleanup_rate_limits() is defined but never called, causing unbounded
-- table growth. Since pg_cron is not available on Supabase free tier, we add
-- probabilistic inline cleanup to check_rate_limit() — on ~1% of calls,
-- old records are deleted before processing.

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
  -- Probabilistic cleanup: ~1% of calls clean up old records
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limits
    WHERE created_at < NOW() - INTERVAL '2 hours';
  END IF;

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
