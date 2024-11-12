import type { Store, Options, IncrementResponse, ClientRateLimitInfo } from "express-rate-limit";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import {
  MetriportError,
  errorToString,
  rateLimitCountSchema,
  rateLimitLimitSchema,
  rateLimitLimitKey,
} from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { capture, out } from "../../util";
import { DynamoDbUtils } from "../../external/aws/dynamodb";

type DynamoStoreOptions = {
  /**
   * Optional field to differentiate hit countswhen multiple rate-limits are in use
   */
  countPrefix?: string;
  limitPrefix?: string;

  /**
   * Some store-specific parameter
   */
  table: string;
  partitionKey: string;
  client?: DocumentClient;
};

/**
 * A `Store` that stores the hit count for each client.
 */
export class DynamoStore implements Store {
  /**
   * Some store-specific parameter.
   */
  ddbUtils: DynamoDbUtils;

  /**
   * The duration of time before which all hit counts are reset (in milliseconds).
   */
  windowMs!: number;

  countPrefix!: string;
  limitPrefix!: string;

  /**
   * @constructor for `DynamoStore`. Only required if the user needs to pass
   * some store specific parameters. For example, in a Mongo Store, the user will
   * need to pass the URI, username and password for the Mongo database.
   *
   * Accepting a custom `prefix` here is also recommended.
   *
   * @param options {DynamoStoreOptions} - Prefix and any store-specific parameters.
   */
  constructor(options: DynamoStoreOptions) {
    this.countPrefix = options.countPrefix ?? "count_";
    this.limitPrefix = options.limitPrefix ?? "limit_";
    if (this.countPrefix === this.limitPrefix) {
      throw new MetriportError("Cannot of conflicting prefixes", undefined, {
        countPrefix: this.countPrefix,
        limitPrefix: this.limitPrefix,
      });
    }
    this.ddbUtils = new DynamoDbUtils({
      table: options.table,
      partitionKey: options.partitionKey,
      client: options.client,
    });
  }

  /**
   * Method that actually initializes the store. Must be synchronous.
   *
   * This method is optional, it will be called only if it exists.
   *
   * @param options {Options} - The options used to setup express-rate-limit.
   *
   * @public
   */
  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  /**
   * Method to prefix the keys with the given text.
   *
   * Call this from get, increment, decrement, resetKey, etc.
   *
   * @param key {string} - The key.
   *
   * @returns {string} - The text + the key.
   */
  prefixCountKey(key: string): string {
    return `${this.countPrefix}${key}`;
  }

  /**
   * Method to prefix the settings keys with the given text.
   *
   * Call this from getSettings, etc.
   *
   * @param key {string} - The key.
   *
   * @returns {string} - The text + the key.
   */
  prefixLimitKey(key: string): string {
    return `${this.limitPrefix}${key}`;
  }

  /**
   * Method to fetch a client's hit count and reset time.
   *
   * @param key {string} - The identifier for a client.
   *
   * @returns {ClientRateLimitInfo} - The number of hits and reset time for that client.
   *
   * @public
   */
  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const { log } = out(`DynamoStore get - key ${key}`);
    const item = await this.ddbUtils.get({ partition: this.prefixCountKey(key) });
    if (!item.Item) return undefined;
    const entry = rateLimitCountSchema.safeParse(item.Item);
    if (!entry.success) {
      const error = entry.error;
      const msg = `Error parsing Dynamo rate limit store entry`;
      log(`${msg} - error: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          key,
          context: "dynamo-store.get",
          error,
        },
      });
      return undefined;
    }
    return {
      totalHits: entry.data.totalHits,
      resetTime: buildDayjs(entry.data.resetTime).toDate(),
    };
  }

  /**
   * Method to increment a client's hit counter.
   *
   * @param key {string} - The identifier for a client.
   *
   * @returns {IncrementResponse} - The number of hits and reset time for that client.
   *
   * @public
   */
  async increment(key: string): Promise<IncrementResponse> {
    const { log } = out(`DynamoStore increment - key ${key}`);
    const item = await this.ddbUtils.update({
      partition: this.prefixCountKey(key),
      expression: "ADD totalHits :inc",
      expressionAttributesValues: {
        ":inc": 1,
      },
    });
    const entry = rateLimitCountSchema.safeParse(item.Attributes);
    if (!entry.success) {
      const error = entry.error;
      const msg = `Error parsing DynamoStore count entry`;
      log(`${msg} - error: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          key,
          context: "dynamo-store.increment",
          error,
        },
      });
      throw new MetriportError(msg, undefined, { method: "increment", key });
    }
    return {
      totalHits: entry.data.totalHits,
      resetTime: buildDayjs(entry.data.resetTime).toDate(),
    };
  }

  /**
   * Method to decrement a client's hit counter.
   *
   * @param key {string} - The identifier for a client.
   *
   * @public
   */
  async decrement(key: string): Promise<void> {
    const { log } = out(`DynamoStore decrement - key ${key}`);
    const item = await this.ddbUtils.update({
      partition: this.prefixCountKey(key),
      expression: "ADD totalHits :inc",
      expressionAttributesValues: {
        ":inc": -1,
      },
    });
    const entry = rateLimitCountSchema.safeParse(item.Attributes);
    if (!entry.success) {
      const error = entry.error;
      const msg = `Error parsing DynamoStore count entry`;
      log(`${msg} - error: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          key,
          context: "dynamo-store.decrement",
          error,
        },
      });
      throw new MetriportError(msg, undefined, { method: "decrement", key });
    }
  }

  /**
   * Method to reset a client's hit counter.
   *
   * @param key {string} - The identifier for a client.
   *
   * @public
   */
  async resetKey(key: string): Promise<void> {
    const { log } = out(`DynamoStore resetKey - key ${key}`);
    const item = await this.ddbUtils.update({
      partition: this.prefixCountKey(key),
      expression: "totalHits  = :totalHits, resetTime = :resetTime",
      expressionAttributesValues: {
        ":totalHits": 0,
        ":resetTime": buildDayjs().add(this.windowMs, "milliseconds").unix(),
      },
    });
    const entry = rateLimitCountSchema.safeParse(item.Attributes);
    if (!entry.success) {
      const error = entry.error;
      const msg = `Error parsing DynamoStore count entry`;
      log(`${msg} - error: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          key,
          context: "dynamo-store.resetKey",
          error,
        },
      });
      throw new MetriportError(msg, undefined, { method: "resetKey", key });
    }
  }

  /**
   * Method to fetch a client's limit. Introduced by Metriport.
   *
   * @param key {string} - The identifier for a client.
   *
   * @returns {number} - The limit of hits within the window.
   *
   * @public
   */
  async getLimit(key: string, defaultLimit: number): Promise<number> {
    const { log } = out(`DynamoStore get - key ${key}`);
    const item = await this.ddbUtils.get({ partition: this.prefixLimitKey(key) });
    if (!item.Item) {
      const windowLimitAttribute = `:${rateLimitLimitKey}`;
      await this.ddbUtils.update({
        partition: this.prefixLimitKey(key),
        expression: `set ${rateLimitLimitKey} = ${windowLimitAttribute}`,
        expressionAttributesValues: { [windowLimitAttribute]: defaultLimit },
      });
      return defaultLimit;
    }
    const entry = rateLimitLimitSchema.safeParse(item.Item);
    if (!entry.success) {
      const error = entry.error;
      const msg = `Error parsing DynamoStore limit entry`;
      log(`${msg} - error: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          key,
          context: "dynamo-store.getSettings",
          error,
        },
      });
      throw new MetriportError(msg, undefined, { method: "getLimit", key, defaultLimit });
    }
    return entry.data.windowLimit;
  }
}

// Export the store so others can use it
export default DynamoStore;
