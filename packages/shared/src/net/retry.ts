import axios from "axios";
import {
  defaultOptions as defaultRetryWithBackoffOptions,
  executeWithRetries,
  ExecuteWithRetriesOptions,
} from "../common/retry";
import { NetworkError } from "./error";

export type ExecuteWithHttpRetriesOptions = Omit<
  ExecuteWithRetriesOptions<unknown>,
  "shouldRetry"
> & {
  /** The network error codes to retry. See `defaultOptions` for defaults. */
  httpCodesToRetry: NetworkError[];
  httpStatusCodesToRetry: number[];
};

const defaultOptions: ExecuteWithHttpRetriesOptions = {
  ...defaultRetryWithBackoffOptions,
  initialDelay: 1000,
  httpCodesToRetry: [
    // https://nodejs.org/docs/latest-v18.x/api/errors.html#common-system-errors
    "ECONNREFUSED", // (Connection refused): No connection could be made because the target machine actively refused it. This usually results from trying to connect to a service that is inactive on the foreign host.
    "ECONNRESET", //  (Connection reset by peer): A connection was forcibly closed by a peer. This normally results from a loss of the connection on the remote socket due to a timeout or reboot. Commonly encountered via the http and net modules.
  ],
  httpStatusCodesToRetry: [429], // 429 Too Many Requests
};

/**
 * Executes a function with retries and backoff with jitter. If the function throws a network
 * error, it will retry up to maxAttempts-1, waiting between each retry.
 * If the function throws an error on the last attempt, it will throw the error.
 * If the function succeeds, it will return the result.
 * This is a specialization of `executeWithRetries` for network errors.
 * By default it retries on ECONNREFUSED and ECONNRESET (customize the errors to retry
 * setting the option `httpCodesToRetry`).
 * By default it also retries on HTTP status code 429 (Too Many Requests).
 *
 * @param fn the function to be executed
 * @param options the options to be used; see `ExecuteWithHttpRetriesOptions` for components and
 *        `defaultOptions` for defaults.
 * @returns the result of calling the `fn` function
 * @see `executeWithRetries()`
 *
 */
export async function executeWithNetworkRetries<T>(
  fn: () => Promise<T>,
  options?: Partial<ExecuteWithHttpRetriesOptions>
): Promise<T> {
  const actualOptions = { ...defaultOptions, ...options };
  const { httpCodesToRetry, httpStatusCodesToRetry } = actualOptions;
  const codesAsString = httpCodesToRetry.map(String);
  return executeWithRetries(fn, {
    ...actualOptions,
    shouldRetry: (_, error: unknown) => {
      const networkCode = axios.isAxiosError(error) ? error.code : undefined;
      const networkStatus = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (!networkCode && !networkStatus) return false;
      return (
        (networkCode && codesAsString.includes(networkCode)) ||
        (networkStatus && httpStatusCodesToRetry.includes(networkStatus)) ||
        false
      );
    },
  });
}
