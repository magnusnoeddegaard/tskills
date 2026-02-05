/**
 * Retry logic with exponential backoff for network operations
 */

import { NetworkError } from './errors.js';

/**
 * Options for retry behavior
 */
export interface RetryOptions {
  /** Maximum number of attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in milliseconds (default: 1000) */
  baseDelayMs?: number;
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelayMs?: number;
  /** Function to determine if error should trigger retry */
  shouldRetry?: (error: Error) => boolean;
  /** Callback called before each retry */
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
}

/**
 * Default retry options
 */
const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  shouldRetry: (error) => error instanceof NetworkError,
};

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  // Exponential backoff: baseDelay * 2^(attempt-1)
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);

  // Add jitter (random 0-1000ms) to prevent thundering herd
  const jitter = Math.random() * 1000;

  // Cap at max delay
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

/**
 * Sleep for the specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an async operation with retry logic
 *
 * @example
 * ```typescript
 * const data = await withRetry(
 *   () => fetchFromApi(),
 *   { maxAttempts: 5, onRetry: (err, attempt) => console.log(`Retry ${attempt}...`) }
 * );
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry
      const shouldRetry = opts.shouldRetry(lastError);
      const isLastAttempt = attempt === opts.maxAttempts;

      if (!shouldRetry || isLastAttempt) {
        throw lastError;
      }

      // Calculate delay for next attempt
      const delay = calculateDelay(attempt, opts.baseDelayMs, opts.maxDelayMs);

      // Call retry callback if provided
      if (options.onRetry) {
        options.onRetry(lastError, attempt, delay);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError;
}

/**
 * Check if an error is retryable (network-related)
 */
export function isRetryableError(error: Error): boolean {
  // Our NetworkError class
  if (error instanceof NetworkError) {
    return true;
  }

  // Check error message for network-related patterns
  const message = error.message.toLowerCase();
  const networkPatterns = [
    'fetch failed',
    'network',
    'econnrefused',
    'econnreset',
    'etimedout',
    'enotfound',
    'timeout',
    'socket hang up',
    'dns',
  ];

  return networkPatterns.some((pattern) => message.includes(pattern));
}

/**
 * Create a retry wrapper with custom options
 *
 * @example
 * ```typescript
 * const retrier = createRetrier({ maxAttempts: 5 });
 * const data = await retrier(() => fetchData());
 * ```
 */
export function createRetrier(
  defaultOptions: RetryOptions = {}
): <T>(operation: () => Promise<T>, options?: RetryOptions) => Promise<T> {
  return <T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> => {
    return withRetry(operation, { ...defaultOptions, ...options });
  };
}
