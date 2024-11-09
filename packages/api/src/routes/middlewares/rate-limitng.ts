import { checkRateLimit as checkRateLimitCore } from "@metriport/core/command/rate-limiting/rate-limiting";
import { RateLimit, RateLimitOperation } from "@metriport/shared";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
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
    const { log } = out(
      `checkRateLimit - cxId ${cxId} operation ${operation} rateLimit ${rateLimit}`
    );

    const allowed = await checkRateLimitCore({
      cxId,
      operation,
      rateLimit,
      client: getDB().doc,
    });

    if (!allowed) {
      const msg = `Too many requests for ${routeMapForError[operation]} - please reduce your request rate for this operation`;
      log(msg);
      capture.message(msg, {
        extra: {
          cxId,
          operation,
          rateLimit,
        },
        level: "info",
      });
      // TODO Enable error after monitoring
      //throw new TooManyRequestsError(msg);
    }

    next();
  };
}
