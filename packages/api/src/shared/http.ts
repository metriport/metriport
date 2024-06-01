import { Request } from "express";
import httpStatus from "http-status";
import { ZodError } from "zod";

export function isHttpOK(statusCode: number): boolean {
  return httpStatus[`${statusCode}_CLASS`] === httpStatus.classes.SUCCESSFUL;
}

export function isHttpClientError(statusCode: number): boolean {
  return httpStatus[`${statusCode}_CLASS`] === httpStatus.classes.CLIENT_ERROR;
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isClientError(error: any): boolean {
  if (error.status) return isHttpClientError(error.status);
  if (error.statusCode) return isHttpClientError(error.statusCode);
  if (error instanceof ZodError) return true;
  return false;
}

export function getETag(req: Request): {
  eTag: string | undefined;
} {
  const eTagHeader = req.header("If-Match");
  const eTagPayload = req.body.eTag;
  return {
    eTag: eTagHeader ?? eTagPayload,
  };
}

/**
 * Returns the HTTP status of an error. This is based on Axios error object.
 *
 * @param error error instance
 * @returns HTTP status of the error, 500 if it can't be determined
 */
export function getHttpStatusFromAxiosError(error: unknown): number {
  const status = getHttpStatusFromAxiosErrorOptional(error);
  return status ?? (isTimeoutError(error) ? 504 : 500);
}

/**
 * Returns the HTTP status of an error. This is based on Axios error object.
 *
 * @param error error instance
 * @returns HTTP status of the error, undefined if it can't be determined
 */
export function getHttpStatusFromAxiosErrorOptional(err: unknown): number | undefined {
  if (err && typeof err === "object" && `response` in err) {
    const response = err.response;
    if (response && typeof response === "object" && `status` in response) {
      const status = response.status;

      if (status && typeof status === "number") {
        return status;
      }
      if (status && typeof status === "string") {
        return Number.parseInt(status);
      }
    }
  }
  return undefined;
}

/**
 * Returns true if the error is a timeout error. This is based on Axios error object.
 *
 * @param error error instance
 * @returns boolean indicating if the error is a timeout error
 */
export function isTimeoutError(error: unknown): boolean {
  if (error && typeof error === "object" && `code` in error) {
    return error.code === `ETIMEDOUT`;
  }
  return false;
}
