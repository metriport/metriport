import { getRateLimiter } from "@metriport/core/command/rate-limiting/rate-limiting";
import { RateLimitWindow, RateLimitOperation } from "@metriport/shared";
import { NextFunction, Request, Response } from "express";
import { getDB } from "../../models/db";
import { getCxIdOrFail } from "../util";

/**
 * Checks the CX request for the given operation and rate limit with fixed window.
 */
export function checkRateLimit(
  operation: RateLimitOperation,
  window?: RateLimitWindow
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const cxId = getCxIdOrFail(req);

    const rateLimiter = await getRateLimiter({
      cxId,
      operation,
      window,
      client: getDB().doc,
    });
    if (!rateLimiter) {
      next();
    } else {
      rateLimiter(req, res, next);
    }
  };
}
