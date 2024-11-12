import { RateLimitRequestHandler, rateLimit } from "express-rate-limit";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import {
  RateLimitOperation,
  RateLimitWindow,
  rateLimitPartitionKey,
  oneMinuteInMs,
} from "@metriport/shared";
import { DynamoStore } from "./ddb-store";
import { Config } from "../../util/config";

const routeMapForError: Record<RateLimitOperation, string> = {
  patientQuery: "Too many patient creates or updates, please try again later.",
  documentQuery: "Too many patient documeny query starts, please try again later.",
  consolidatedDataQuery: "Too many patient consolidated data query starts, please try again later.",
};

const defaultOperationLimits: {
  [k in RateLimitOperation]: { [k in RateLimitWindow]: number };
} = {
  patientQuery: {
    [oneMinuteInMs]: 10,
  },
  documentQuery: {
    [oneMinuteInMs]: 10,
  },
  consolidatedDataQuery: {
    [oneMinuteInMs]: 100,
  },
};

export async function getRateLimiter({
  cxId,
  operation,
  window = 60000,
  client,
}: {
  cxId: string;
  operation: RateLimitOperation;
  window?: RateLimitWindow;
  client?: DocumentClient;
}): Promise<RateLimitRequestHandler | undefined> {
  const table = Config.getRateLimitTableName();
  if (!table) return undefined;
  const store = new DynamoStore({
    table,
    partitionKey: rateLimitPartitionKey,
    ...(client && { client }),
  });
  const key = `${cxId}_${operation}_${window}`;
  const defaultLimit = defaultOperationLimits[operation][window];
  const limit = await store.getLimit(key, defaultLimit);
  return rateLimit({
    windowMs: window,
    limit,
    message: routeMapForError[operation],
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    store,
    passOnStoreError: true,
    keyGenerator: () => key,
  });
}
