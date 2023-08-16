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
