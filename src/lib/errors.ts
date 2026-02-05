/**
 * Custom error classes for tskills CLI
 * Provides typed errors with structured information for better error handling
 */

/**
 * Base error class for all tskills errors
 */
export class TskillsError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TskillsError';
    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Network-related errors (connection failures, timeouts, DNS issues)
 */
export class NetworkError extends TskillsError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
  }
}

/**
 * Authentication errors (invalid token, expired session, not logged in)
 */
export class AuthError extends TskillsError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'AUTH_ERROR', details);
    this.name = 'AuthError';
  }
}

/**
 * Input validation errors (invalid format, missing fields, constraint violations)
 */
export class ValidationError extends TskillsError {
  constructor(
    message: string,
    public readonly field?: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'VALIDATION_ERROR', { ...details, field });
    this.name = 'ValidationError';
  }
}

/**
 * Rate limit exceeded errors
 */
export class RateLimitError extends TskillsError {
  constructor(
    message: string,
    public readonly retryAfter: number, // seconds until retry allowed
    public readonly limit: number, // max requests allowed
    public readonly remaining: number, // requests remaining
    details?: Record<string, unknown>
  ) {
    super(message, 'RATE_LIMIT_ERROR', {
      ...details,
      retryAfter,
      limit,
      remaining,
    });
    this.name = 'RateLimitError';
  }
}

/**
 * Resource not found errors (skill, org, team, user not found)
 */
export class NotFoundError extends TskillsError {
  constructor(
    message: string,
    public readonly resource: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'NOT_FOUND_ERROR', { ...details, resource });
    this.name = 'NotFoundError';
  }
}

/**
 * Permission denied errors (RLS violations, insufficient role)
 */
export class PermissionError extends TskillsError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'PERMISSION_ERROR', details);
    this.name = 'PermissionError';
  }
}

/**
 * File system errors (write failures, permission denied, disk full)
 */
export class FileSystemError extends TskillsError {
  constructor(
    message: string,
    public readonly path?: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'FILESYSTEM_ERROR', { ...details, path });
    this.name = 'FileSystemError';
  }
}

/**
 * Configuration errors (invalid config, missing required settings)
 */
export class ConfigError extends TskillsError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFIG_ERROR', details);
    this.name = 'ConfigError';
  }
}
