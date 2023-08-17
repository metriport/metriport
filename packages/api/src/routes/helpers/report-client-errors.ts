import { NextFunction, Request, Response } from "express";

const reportClientErrorsProp = "reportClientErrors";

export function setReportClientErrors(req: Request): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (req as any)[reportClientErrorsProp] = true;
}
export function isReportClientErrors(req: Request): boolean | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (req as any)[reportClientErrorsProp];
}

/**
 * Middleware to report client errors to Sentry.
 *
 * Under the hood it just sets a property on the request object, so it can be
 * checked later on by the default error handler - should an error occur.
 */
export function reportClientErrors(req: Request, res: Response, next: NextFunction): void {
  setReportClientErrors(req);
  next();
}
