import { errorToString } from "./error";
import { sleep } from "./sleep";

/**
 * Executes a function with retries. If the function throws an error, it will retry
 * up to maxRetries times, waiting waitTime between each retry.
 * If the function throws an error on the last retry, it will throw the error.
 * If the function succeeds, it will return the result.
 *
 * @param fn the function to be executed
 * @param maxRetries the maximum number of retries, defaults to 3
 * @param waitTime the time to wait between retries, defaults to 3000ms
 * @param log the logger to use, defaults to console.log
 * @returns the result of calling the `fn` function
 */
export async function executeWithRetriesOrFail<K>(
  fn: () => Promise<K>,
  maxRetries = 3,
  waitTime = 3000,
  log = console.log
): Promise<K> {
  let count = 0;
  while (count <= maxRetries) {
    try {
      return await fn();
    } catch (e) {
      const msg = `Error on executeWithRetriesOrFail: ${e}, `;
      if (count++ < maxRetries) {
        log(`${msg}, retrying...`);
        await sleep(waitTime);
        continue;
      }
      log(`${msg}, gave up.`);
      throw e;
    }
  }
  throw new Error(`Should never get here`);
}

/**
 * Executes a function with retries. If the function throws an error, it will retry
 * up to maxRetries times, waiting waitTime between each retry.
 * If the function throws an error on the last retry, it will return undefined.
 * If the function succeeds, it will return the result.
 *
 * @param fn the function to be executed
 * @param maxRetries the maximum number of retries, defaults to 3
 * @param waitTime the time to wait between retries, defaults to 3000ms
 * @param log the logger to use, defaults to console.log
 * @returns the result of calling the `fn` function, or undefined if it fails
 */
export async function executeWithRetries<K>(
  fn: () => Promise<K>,
  maxRetries = 3,
  waitTime = 3000,
  log = console.log
): Promise<K | undefined> {
  try {
    return await executeWithRetriesOrFail(fn, maxRetries, waitTime, log);
  } catch (e) {
    log(`Error calling executeWithRetriesOrFail, returning undefined: ${errorToString(e)}`);
    return undefined;
  }
}
