import { DynamoStore } from "@metriport/core/command/rate-limiting/ddb-store";
import {
  MetriportError,
  RateLimitOperation,
  RateLimitWindow,
  defaultOperationLimits,
  oneMinuteInMs,
  rateLimitOperations,
  rateLimitPartitionKey,
  rateLimitWindows,
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
  operation: RateLimitOperation,
  window: RateLimitWindow = oneMinuteInMs
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!rateLimiter) {
      next();
    } else {
      req.rateLimitOperation = operation;
      req.rateLimitWindow = window;
      rateLimiter(req, res, next);
    }
  };
}

export function createRateLimiter(window = oneMinuteInMs): RateLimitRequestHandler | undefined {
  const table = Config.getRateLimitTableName();
  if (!table) return undefined;
  const store = new DynamoStore({
    table,
    partitionKey: rateLimitPartitionKey,
    client: getDB().doc,
  });
  return rateLimit({
    windowMs: window,
    limit: async (req: Request) => {
      const { cxId, operation, window } = parseRequest(req);
      const key = createKey(cxId, operation, window);
      const defaultLimit = defaultOperationLimits[operation][window];
      return await store.getLimit(key, defaultLimit);
    },
    message: async (req: Request) => {
      const { operation } = parseRequest(req);
      return routeMapForError[operation];
    },
    standardHeaders: true,
    legacyHeaders: false,
    store,
    passOnStoreError: true,
    keyGenerator: async (req: Request) => {
      const { cxId, operation, window } = parseRequest(req);
      return createKey(cxId, operation, window);
    },
  });
}

function parseRequest(req: Request): {
  cxId: string;
  operation: RateLimitOperation;
  window: RateLimitWindow;
} {
  const cxId = getCxIdOrFail(req);
  const operation = req.rateLimitOperation as RateLimitOperation;
  const window = req.rateLimitWindow as RateLimitWindow;
  if (!cxId || !operation || !window) {
    throw new MetriportError("Rate limiter can't create key to determine limit", undefined, {
      cxId,
      operation,
      window,
    });
  }
  if (!rateLimitOperations.includes(operation)) {
    throw new MetriportError("Request rateLimitOperation is not a valid operation", undefined, {
      operation,
    });
  }
  if (!rateLimitWindows.includes(window)) {
    throw new MetriportError("Request rateLimitWindow is not a valid window", undefined, {
      operation,
    });
  }
  return { cxId, operation, window };
}

function createKey(cxId: string, operation: RateLimitOperation, window: RateLimitWindow): string {
  return `${cxId}_${operation}_${window}`;
}
