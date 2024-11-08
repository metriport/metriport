import { checkRateLimit as checkRateLimitCore } from "@metriport/core/command/rate-limiting/rate-limiting";
import { RateLimit, RateLimitOperation, TooManyRequestsError } from "@metriport/shared";
import { NextFunction, Request, Response } from "express";
import { getDB } from "../../models/db";
import { getCxIdOrFail } from "../util";

const routeMapForError: Record<RateLimitOperation, string> = {
  patientQuery: "patient create or update",
  documentQuery: "documeny query start",
  consolidatedDataQuery: "consolidated data query start",
};

/**
 * Checks the CX request for the given operation and rate limit sliding window.
 */
export function checkRateLimit(
  operation: RateLimitOperation,
  rateLimit: RateLimit
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, _: Response, next: NextFunction): Promise<void> => {
    const cxId = getCxIdOrFail(req);

    const allowed = await checkRateLimitCore({
      cxId,
      operation,
      rateLimit,
      client: getDB().doc,
    });

    if (!allowed) {
      throw new TooManyRequestsError(
        `Too many requests for ${routeMapForError[operation]} - please reduce your request rate for this operation`
      );
    }

    next();
  };
}
