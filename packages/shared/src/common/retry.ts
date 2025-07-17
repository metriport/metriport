import { random } from "lodash";
import { MetriportError } from "../error/metriport-error";
import { errorToString } from "../error/shared";
import { emptyFunction } from "./general";
import { sleep } from "./sleep";

function defaultShouldRetry<T>(_: T | undefined, error: unknown) {
  if (error) return true;
  return false;
}

export const defaultOptions: Required<ExecuteWithRetriesOptions<unknown>> = {
  initialDelay: 10,
  maxDelay: Infinity,
  backoffMultiplier: 2,
  maxAttempts: 5,
  shouldRetry: defaultShouldRetry,
  onError: emptyFunction,
  getTimeToWait: defaultGetTimeToWait,
  log: console.log,
};

export type ExecuteWithRetriesOptions<T> = {
  /** The intitial delay in milliseconds. Defaults to 10ms. */
  initialDelay?: number;
  /** The maximum delay in milliseconds. Defaults to Infinity. */
  maxDelay?: number;
  /**
   * Determines how the backoff is calculated.
   * Defaults to 2 (exponential backoff).
   * Set to 0 to disable backoff.
   */
  backoffMultiplier?: number;
  /** The maximum number of retries. Defaults to 5. */
  maxAttempts?: number;
  /** Function to determine if the error should be retried. Defaults to always retry. */
  shouldRetry?: (
    result: T | undefined,
    error: unknown,
    attempt: number
  ) => boolean | Promise<boolean>;
  /**
   * Function to be called when an error occurs. It doesn't change whether shouldRetry is called
   * or not, nor does it change the result of that function.
   * It's called before shouldRetry.
   */
  onError?: (error: unknown) => void;
  /** Function to determine if the result should be retried. Defaults to always retry. */
  /** Function to determine how long to wait before the next retry. It should not be changed. */
  getTimeToWait?: (params: GetTimeToWaitParams) => number;
  /** Function to log details about the execution */
  log?: typeof console.log;
};

export type GetTimeToWaitParams = {
  initialDelay: number;
  backoffMultiplier: number;
  attempt: number;
  maxDelay: number;
  error?: unknown;
};

/**
 * Executes a function with retries and backoff with jitter.
 * Decides whether or not to retry based on the `shouldRetry()` function parameter - by default
 * it only retries on error.
 * If the function doesn't throw errors and `shouldRetry` returns true, it will return the last
 * function's result when it reaches the maximum attempts.
 * It retries up to maxAttempts-1, waiting between each retry.
 * If the function throws an error on the last attempt, it will throw the error.
 * If the function succeeds and `shouldRetry` returns false, it will return the function's result.
 *
 * @param fn the function to be executed
 * @param options the options to be used; see `ExecuteWithRetriesOptions` for components and
 *        `defaultOptions` for defaults.
 * @returns the result of calling the `fn` function
 * @see https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
 */
export async function executeWithRetries<T>(
  fn: (attempt: number) => Promise<T>,
  options: ExecuteWithRetriesOptions<T> = defaultOptions
): Promise<T> {
  const actualOptions = { ...defaultOptions, ...options };
  const {
    initialDelay,
    maxDelay,
    backoffMultiplier,
    maxAttempts: _maxAttempts,
    shouldRetry,
    onError,
    getTimeToWait,
    log,
  } = actualOptions;
  const context = "executeWithRetries";
  const maxAttempts = Math.max(_maxAttempts, 1);
  let attempt = 0;
  while (++attempt <= maxAttempts) {
    try {
      const result = await fn(attempt);
      if (await shouldRetry(result, undefined, attempt)) {
        if (attempt >= maxAttempts) {
          log(`[${context}] Gave up after ${attempt} attempts.`);
          return result;
        }
        log(`[${context}] Retrying... (attempt: ${attempt})`);
        continue;
      }
      return result;
    } catch (error) {
      onError?.(error);
      const msg = `[${context}] Error: ${errorToString(error)}`;
      if (attempt >= maxAttempts) {
        log(`${msg}, gave up after ${attempt} attempts.`);
        throw error;
      }
      if (!(await shouldRetry(undefined, error, attempt))) {
        log(`${msg}, should not retry (after ${attempt} attempts).`);
        throw error;
      }
      log(`${msg}, retrying... (attempt: ${attempt})`);
      const timeToWait = getTimeToWait({
        initialDelay,
        backoffMultiplier,
        attempt,
        maxDelay,
        error,
      });
      await sleep(timeToWait);
    }
  }
  throw new MetriportError("Unreachable code", undefined, {
    attempt,
    maxAttempts,
    context,
  });
}

export function defaultGetTimeToWait({
  initialDelay,
  backoffMultiplier,
  attempt,
  maxDelay,
}: GetTimeToWaitParams) {
  if (backoffMultiplier < 1) return initialDelay;
  const temp = Math.min(initialDelay * Math.pow(backoffMultiplier, attempt), maxDelay);
  const timeToWait = temp / 2 + random(0, temp / 2);
  return timeToWait;
}

/**
 * Executes a function with retries and backoff with jitter. If the function throws an error, it will retry
 * up to maxAttempts-1, waiting between each retry.
 * If the function throws an error on the last attempt, it will return `undefined`.
 * If the function succeeds, it will return the result.
 *
 * @param fn the function to be executed
 * @param options the options to be used; see `ExecuteWithRetriesOptions` for components and
 *        `defaultOptions` for defaults.
 * @returns the result of calling the `fn` function
 * @see https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
 */
export async function executeWithRetriesSafe<T>(
  fn: () => Promise<T>,
  options?: Partial<ExecuteWithRetriesOptions<T>>
): Promise<T | undefined> {
  const actualOptions = { ...defaultOptions, ...options };
  const { log } = actualOptions;
  try {
    return await executeWithRetries(fn, options);
  } catch (e) {
    log(`[executeWithRetriesSafe] Error: ${errorToString(e)}`);
    return undefined;
  }
}
