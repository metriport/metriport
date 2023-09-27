/**
 * Axios specific. Checks if the error is a timeout or related error.
 *
 * @param err instance of AxiosError
 * @returns boolean indicating whether the error can be considered a timeout error
 */
export function isAxiosTimeout(err: { code: string; response?: { status: number } }): boolean {
  return (
    err.code === "ETIMEDOUT" ||
    err.code === "ERR_BAD_RESPONSE" || // Axios code for 502
    err.code === "ECONNRESET" ||
    err.code === "ESOCKETTIMEDOUT" ||
    err.response?.status === 503 ||
    err.response?.status === 504
  );
}

/**
 * Axios specific. Checks if the error is a bad gateway one.
 *
 * @param err instance of AxiosError
 * @returns boolean indicating whether the error can be considered a bad gateway error
 */
export function isAxiosBadGateway(err: { code: string; response?: { status: number } }): boolean {
  return (
    err.code === "ERR_BAD_RESPONSE" || // Axios code for 502
    err.response?.status === 502
  );
}
