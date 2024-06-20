import axios from "axios";
import {
  defaultOptions as defaultRetryWithBackoffOptions,
  executeWithRetries,
  ExecuteWithRetriesOptions,
} from "../common/retry";
import { NetworkError, networkTimeoutErrors } from "./error";

export type ExecuteWithNetworkRetriesOptions = Omit<
  ExecuteWithRetriesOptions<unknown>,
  "shouldRetry"
> & {
  /** The network error codes to retry. See `defaultOptions` for defaults. */
  httpCodesToRetry: NetworkError[];
  httpStatusCodesToRetry: number[];
  /** Whether to retry on timeout errors. Default is false. */
  retryOnTimeout?: boolean;
};

const defaultOptions: ExecuteWithNetworkRetriesOptions = {
  ...defaultRetryWithBackoffOptions,
  initialDelay: 1000,
  httpCodesToRetry: [
    // https://nodejs.org/docs/latest-v18.x/api/errors.html#common-system-errors
    "ECONNREFUSED", // (Connection refused): No connection could be made because the target machine actively refused it. This usually results from trying to connect to a service that is inactive on the foreign host.
    "ECONNRESET", //  (Connection reset by peer): A connection was forcibly closed by a peer. This normally results from a loss of the connection on the remote socket due to a timeout or reboot. Commonly encountered via the http and net modules.
    "ENOTFOUND", //  (DNS lookup failed): Indicates a DNS failure of either EAI_NODATA or EAI_NONAME. This is not a standard POSIX error.
  ],
  httpStatusCodesToRetry: [429], // 429 Too Many Requests
  retryOnTimeout: false,
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
  options?: Partial<ExecuteWithNetworkRetriesOptions>
): Promise<T> {
  const actualOptions = { ...defaultOptions, ...options };

  const { httpCodesToRetry: httpCodesFromParams, httpStatusCodesToRetry } = actualOptions;

  const httpCodesToRetry = actualOptions.retryOnTimeout
    ? [...httpCodesFromParams, ...networkTimeoutErrors]
    : httpCodesFromParams;

  const codesAsString = httpCodesToRetry.map(String);

  return executeWithRetries(fn, {
    ...actualOptions,
    shouldRetry: (_, error: unknown) => {
      const networkCode = axios.isAxiosError(error) ? error.code : undefined;
      const networkStatus = axios.isAxiosError(error) ? error.response?.status : undefined;
      return (
        (networkCode && codesAsString.includes(networkCode)) ||
        (networkStatus && httpStatusCodesToRetry.includes(networkStatus)) ||
        false
      );
    },
  });
}
