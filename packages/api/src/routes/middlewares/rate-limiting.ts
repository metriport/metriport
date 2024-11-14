import { DynamoStore } from "@metriport/core/command/rate-limiting/ddb-store";
import {
  MetriportError,
  RateLimitOperation,
  RateLimitWindow,
  defaultOperationLimits,
  globalWindow,
  rateLimitOperations,
  rateLimitPartitionKey,
  routeMapForError,
} from "@metriport/shared";
import { NextFunction, Request, Response } from "express";
import { RateLimitRequestHandler, rateLimit } from "express-rate-limit";
import { getDB } from "../../models/db";
import { Config } from "../../shared/config";
import { getCxIdOrFail } from "../util";

let rateLimiter: RateLimitRequestHandler | undefined;
export function initRateLimiter(): void {
  rateLimiter = createRateLimiter();
}

/**
 * Checks the CX request for the given operation and rate limit with fixed window.
 */
export function checkRateLimit(
  operation: RateLimitOperation
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!rateLimiter) {
      next();
    } else {
      req.rateLimitOperation = operation;
      rateLimiter(req, res, next);
    }
  };
}

export function createRateLimiter(): RateLimitRequestHandler | undefined {
  const table = Config.getRateLimitTableName();
  if (!table) return undefined;
  const store = new DynamoStore({
    table,
    partitionKey: rateLimitPartitionKey,
    client: getDB().doc,
  });
  return rateLimit({
    windowMs: globalWindow.asMilliseconds(),
    limit: async (req: Request) => {
      const { cxId, operation } = parseRequest(req);
      const key = createKey(cxId, operation, globalWindow);
      const defaultLimit = defaultOperationLimits[operation];
      return await store.getLimit(key, defaultLimit);
    },
    message: (req: Request) => {
      const { operation } = parseRequest(req);
      return routeMapForError[operation];
    },
    standardHeaders: true,
    legacyHeaders: false,
    store,
    passOnStoreError: true,
    keyGenerator: (req: Request) => {
      const { cxId, operation } = parseRequest(req);
      return createKey(cxId, operation, globalWindow);
    },
  });
}

function parseRequest(req: Request): {
  cxId: string;
  operation: RateLimitOperation;
} {
  const cxId = getCxIdOrFail(req);
  const operation = req.rateLimitOperation as RateLimitOperation;
  if (!cxId || !operation) {
    throw new MetriportError("Rate limiter can't parse request", undefined, {
      cxId,
      operation,
    });
  }
  if (!rateLimitOperations.includes(operation)) {
    throw new MetriportError("Request rateLimitOperation is not a valid operation", undefined, {
      operation,
    });
  }
  return { cxId, operation };
}

function createKey(cxId: string, operation: RateLimitOperation, window: RateLimitWindow): string {
  return `${cxId}_${operation}_${window.asMilliseconds()}`;
}
