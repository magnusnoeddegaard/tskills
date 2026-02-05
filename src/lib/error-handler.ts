/**
 * Centralized error handling for tskills CLI
 * Maps Supabase/Postgres errors to user-friendly custom errors
 */

import type { PostgrestError } from '@supabase/supabase-js';
import {
  TskillsError,
  NetworkError,
  AuthError,
  ValidationError,
  RateLimitError,
  NotFoundError,
  PermissionError,
  FileSystemError,
} from './errors.js';

/**
 * Maps Postgres/Supabase error codes to custom error factories
 */
const POSTGRES_ERROR_MAP: Record<
  string,
  (message: string, details?: Record<string, unknown>) => TskillsError
> = {
  // Not found (PostgREST returns PGRST116 when .single() returns no rows)
  PGRST116: (msg) => new NotFoundError('Resource not found', 'unknown'),

  // Unique constraint violation
  '23505': (msg, details) =>
    new ValidationError(
      details?.field
        ? `${details.field} already exists`
        : 'A resource with this value already exists',
      details?.field as string | undefined
    ),

  // Foreign key violation
  '23503': () =>
    new ValidationError('Referenced resource does not exist'),

  // Check constraint violation
  '23514': (msg) => new ValidationError(msg || 'Value violates constraint'),

  // Not null violation
  '23502': (msg, details) =>
    new ValidationError(
      `${details?.column || 'Required field'} cannot be empty`,
      details?.column as string | undefined
    ),

  // RLS policy violation
  '42501': () =>
    new PermissionError('You do not have permission to perform this action'),

  // Insufficient privilege
  '42000': () =>
    new PermissionError('Insufficient privileges for this operation'),
};

/**
 * Patterns to detect network-related errors
 */
const NETWORK_ERROR_PATTERNS = [
  /fetch failed/i,
  /network/i,
  /ECONNREFUSED/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /ENOTFOUND/i,
  /timeout/i,
  /socket hang up/i,
  /DNS/i,
];

/**
 * Patterns to detect auth-related errors
 */
const AUTH_ERROR_PATTERNS = [
  /JWT/i,
  /token.*invalid/i,
  /token.*expired/i,
  /session.*expired/i,
  /unauthorized/i,
  /not authenticated/i,
  /please login/i,
];

/**
 * Check if an error message matches network error patterns
 */
function isNetworkError(message: string): boolean {
  return NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Check if an error message matches auth error patterns
 */
function isAuthError(message: string): boolean {
  return AUTH_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Convert a Supabase/Postgres error to a custom tskills error
 */
export function handleSupabaseError(
  error: PostgrestError | Error,
  context?: string
): never {
  const contextPrefix = context ? `${context}: ` : '';
  const message = error.message || 'An unknown error occurred';

  // Check for Postgres error code
  if ('code' in error && error.code) {
    const errorFactory = POSTGRES_ERROR_MAP[error.code];
    if (errorFactory) {
      throw errorFactory(`${contextPrefix}${message}`, {
        originalCode: error.code,
        originalMessage: message,
      });
    }
  }

  // Check for network-related errors
  if (isNetworkError(message)) {
    throw new NetworkError(
      `${contextPrefix}Network error. Please check your connection and try again.`,
      { originalMessage: message }
    );
  }

  // Check for auth-related errors
  if (isAuthError(message)) {
    throw new AuthError(`${contextPrefix}${message}`, {
      originalMessage: message,
    });
  }

  // Generic error - wrap in TskillsError
  throw new TskillsError(`${contextPrefix}${message}`, 'UNKNOWN_ERROR', {
    originalMessage: message,
  });
}

/**
 * Convert a file system error to a custom tskills error
 */
export function handleFileSystemError(
  error: NodeJS.ErrnoException,
  context?: string
): never {
  const contextPrefix = context ? `${context}: ` : '';
  const path = error.path;

  switch (error.code) {
    case 'ENOENT':
      throw new NotFoundError(
        `${contextPrefix}File or directory not found${path ? `: ${path}` : ''}`,
        'file',
        { path }
      );

    case 'EACCES':
    case 'EPERM':
      throw new FileSystemError(
        `${contextPrefix}Permission denied${path ? `: ${path}` : ''}`,
        path
      );

    case 'ENOSPC':
      throw new FileSystemError(
        `${contextPrefix}No space left on disk`,
        path
      );

    case 'EEXIST':
      throw new FileSystemError(
        `${contextPrefix}File already exists${path ? `: ${path}` : ''}`,
        path
      );

    case 'EISDIR':
      throw new FileSystemError(
        `${contextPrefix}Expected a file but found a directory${path ? `: ${path}` : ''}`,
        path
      );

    case 'ENOTDIR':
      throw new FileSystemError(
        `${contextPrefix}Expected a directory but found a file${path ? `: ${path}` : ''}`,
        path
      );

    default:
      throw new FileSystemError(
        `${contextPrefix}${error.message}`,
        path,
        { code: error.code }
      );
  }
}

/**
 * Format an error for CLI display
 * @param error The error to format
 * @param verbose Whether to include detailed information
 */
export function formatErrorForCLI(error: Error, verbose = false): string {
  // Rate limit error - include retry timing
  if (error instanceof RateLimitError) {
    const minutes = Math.ceil(error.retryAfter / 60);
    const timeStr =
      minutes === 1 ? '1 minute' : `${minutes} minutes`;
    return `Rate limit exceeded. Please try again in ${timeStr}.`;
  }

  // Auth error - suggest login
  if (error instanceof AuthError) {
    return `${error.message}\nRun "tskills login" to authenticate.`;
  }

  // Network error - suggest retry
  if (error instanceof NetworkError) {
    return `${error.message}\nPlease check your internet connection and try again.`;
  }

  // Validation error - show field if available
  if (error instanceof ValidationError) {
    if (error.field) {
      return `Invalid ${error.field}: ${error.message}`;
    }
    return error.message;
  }

  // Not found error
  if (error instanceof NotFoundError) {
    return error.message;
  }

  // Permission error
  if (error instanceof PermissionError) {
    return error.message;
  }

  // File system error
  if (error instanceof FileSystemError) {
    return error.message;
  }

  // Generic tskills error
  if (error instanceof TskillsError) {
    const base = error.message;
    if (verbose && error.details) {
      return `${base}\n\nDetails:\n${JSON.stringify(error.details, null, 2)}`;
    }
    return base;
  }

  // Unknown error type
  if (verbose && error.stack) {
    return error.stack;
  }
  return error.message || 'An unexpected error occurred';
}

/**
 * Wraps an async operation with standardized error handling
 * Converts Supabase errors to typed errors automatically
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof TskillsError) {
      throw error; // Already a typed error
    }

    // Check if it's a Supabase/Postgres error
    if (
      error instanceof Error &&
      ('code' in error || isNetworkError(error.message) || isAuthError(error.message))
    ) {
      handleSupabaseError(error, context);
    }

    // Re-throw unknown errors
    throw error;
  }
}
