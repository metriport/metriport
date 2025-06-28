import { executeWithNetworkRetries, ExecuteWithNetworkRetriesOptions } from "@metriport/shared";

export async function executeWithRetriesCw<T>(
  fn: () => Promise<T>,
  options?: Partial<ExecuteWithNetworkRetriesOptions>
): Promise<T> {
  const defaultOptions: Partial<ExecuteWithNetworkRetriesOptions> = {
    retryOnTimeout: true,
    initialDelay: 500,
    maxAttempts: 5,
  };
  return executeWithNetworkRetries(fn, { ...defaultOptions, ...options });
}
