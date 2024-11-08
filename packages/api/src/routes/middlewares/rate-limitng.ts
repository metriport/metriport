import { checkRateLimit as checkRateLimitCore } from "@metriport/core/command/rate-limiting/rate-limiting";
import { RateLimit, RateLimitOperation, TooManyRequestsError } from "@metriport/shared";
import { NextFunction, Request, Response } from "express";
import { getDB } from "../../models/db";
import { getCxIdOrFail } from "../util";

/**
 * Validates the rate limit for the given operation and ratelimit sliding window.
 */
export function checkRateLimit(
  operation: RateLimitOperation,
  rateLimit: RateLimit
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, _: Response, next: NextFunction): Promise<void> => {
    const cxId = getCxIdOrFail(req);

    const underlimit = await checkRateLimitCore({
      cxId,
      operation,
      rateLimit,
      client: getDB().doc,
    });

    if (!underlimit) {
      throw new TooManyRequestsError(
        `Too many requests for ${operation} - please reduce your request rate`
      );
    }

    next();
  };
}
