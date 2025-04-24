import {
  BadRequestError,
  defaultOptionsRequestNotAccepted,
  errorToString,
  executeWithNetworkRetries,
  MetriportError,
  NotFoundError,
} from "@metriport/shared";

/**
 * Wraps the function to call the API with:
 * - executeWithNetworkRetries, just for cases when the request doesn't reach the API;
 * - default error handling.
 *
 * @param functionToRun - The function that contains the call to the API.
 * @param messageWhenItFails - The message to log when the function fails.
 * @param additionalInfo - Additional information to log and include in the wrapped error.
 * @param log - The log function.
 * @returns The result of the function.
 * @throws NotFoundError if the function fails with a 404 status.
 * @throws BadRequestError if the function fails with a 400 status.
 * @throws MetriportError if the function fails.
 */
export async function withDefaultApiErrorHandling<T>({
  functionToRun,
  messageWhenItFails,
  additionalInfo,
  log,
}: {
  functionToRun: () => Promise<T>;
  messageWhenItFails: string;
  additionalInfo?: Record<string, string | number | undefined | null>;
  log?: typeof console.log;
}): Promise<T> {
  try {
    const res = await executeWithNetworkRetries(functionToRun, {
      ...defaultOptionsRequestNotAccepted,
    });
    return res;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    log &&
      log(
        `${messageWhenItFails}. Additional info: ${JSON.stringify(
          additionalInfo
        )}. Cause: ${errorToString(error)}`
      );
    const detailMsg = error.response?.data?.detail ?? messageWhenItFails;
    if (error.response?.status === 404) throw new NotFoundError(detailMsg, error, additionalInfo);
    if (error.response?.status === 400) throw new BadRequestError(detailMsg, error, additionalInfo);
    throw new MetriportError(messageWhenItFails, error, additionalInfo);
  }
}
