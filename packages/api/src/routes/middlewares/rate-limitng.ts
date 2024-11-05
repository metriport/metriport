import { TooManyRequestsError } from "@metriport/shared";
import { RateLimitOperation, RateLimit } from "@metriport/shared/src/domain/rate-limiting";
import { checkRateLimit as checkRateLimitCore } from "@metriport/core/command/rate-limiting/rate-limiting";
import { NextFunction, Request, Response } from "express";
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
    });

    if (!underlimit) {
      throw new TooManyRequestsError();
    }

    next();
  };
}
