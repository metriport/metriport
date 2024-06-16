import { random } from "lodash";
import { MetriportError } from "../error/metriport-error";
import { errorToString } from "../error/shared";
import { sleep } from "./sleep";

export const defaultOptions: Required<ExecuteWithRetriesOptions<unknown>> = {
  initialDelay: 10,
  maxDelay: Infinity,
  backoffMultiplier: 2,
  maxAttempts: 10,
  shouldRetry: () => true,
  shouldRetryResult: () => false,
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
  /** The maximum number of retries. Defaults to 10. */
  maxAttempts?: number;
  /** Function to determine if the error should be retried. Defaults to always retry. */
  shouldRetry?: (error: unknown, attempt: number) => boolean | Promise<boolean>;
  /** Function to determine if the result should be retried. Defaults to always retry. */
  shouldRetryResult?: (result: T) => boolean | Promise<boolean>;
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
};

/**
 * Executes a function with retries and backoff with jitter. If the function throws an error, it will retry
 * up to maxAttempts-1, waiting between each retry.
 * If the function throws an error on the last attempt, it will throw the error.
 * If the function succeeds, it will return the result.
 *
 * @param fn the function to be executed
 * @param options the options to be used; see `ExecuteWithRetriesOptions` for components and
 *        `defaultOptions` for defaults.
 * @returns the result of calling the `fn` function
 * @see https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
 */
export async function executeWithRetries<T>(
  fn: () => Promise<T>,
  options: ExecuteWithRetriesOptions<T> = defaultOptions
): Promise<T> {
  const actualOptions = { ...defaultOptions, ...options };
  const {
    initialDelay,
    maxDelay,
    backoffMultiplier,
    maxAttempts: _maxAttempts,
    shouldRetry,
    getTimeToWait,
    log,
  } = actualOptions;
  const maxAttempts = Math.max(_maxAttempts, 1);
  let attempt = 0;
  while (++attempt <= maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      const msg = `[executeWithRetries] Error: ${errorToString(error)}`;
      if (attempt >= maxAttempts) {
        log(`${msg}, gave up.`);
        throw error;
      }
      if (!(await shouldRetry(error, attempt))) {
        log(`${msg}, should not retry.`);
        throw error;
      }
      log(`${msg}, retrying... (attempt: ${attempt})`);
      const timeToWait = getTimeToWait({ initialDelay, backoffMultiplier, attempt, maxDelay });
      await sleep(timeToWait);
    }
  }
  throw new MetriportError("Unreachable code", undefined, {
    attempt,
    maxAttempts,
    context: "executeWithRetries",
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

/**
 * Executes a function with retries and backoff with jitter. If the result of the function is
 * retryable, it will retry. This function differs from `executeWithRetries` because it does not
 * retry based on the function throwing errors, but rather based on the result of the function.
 * If the function is not retryable on the last attempt, it will return the result.
 * If the function succeeds, it will return the result.
 *
 * @param fn the function to be executed
 * @param options the options to be used; see `ExecuteWithRetriesOptions` for components and
 *        `defaultOptions` for defaults.
 * @returns the result of calling the `fn` function
 * @see https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
 */
export async function executeWithRetriesOnResult<T>(
  fn: () => Promise<T>,
  options: ExecuteWithRetriesOptions<T> = defaultOptions
): Promise<T> {
  const actualOptions = { ...defaultOptions, ...options };
  const {
    initialDelay,
    maxDelay,
    backoffMultiplier,
    maxAttempts: _maxAttempts,
    shouldRetryResult,
    getTimeToWait,
    log,
  } = actualOptions;
  const maxAttempts = Math.max(_maxAttempts, 1);
  let attempt = 0;
  while (++attempt <= maxAttempts) {
    const msg = `[executeWithRetriesErrorIndependent]`;
    try {
      const result = await fn();
      if (attempt >= maxAttempts) {
        log(`${msg}, gave up.`);
        return result;
      }
      if (await shouldRetryResult(result)) {
        throw new Error("Retry");
      }
      return result;
    } catch (error) {
      log(`${msg}, retrying... (attempt: ${attempt})`);
      const timeToWait = getTimeToWait({ initialDelay, backoffMultiplier, attempt, maxDelay });
      await sleep(timeToWait);
    }
  }
  throw new MetriportError("Unreachable code", undefined, {
    attempt,
    maxAttempts,
    context: "executeWithRetries",
  });
}
