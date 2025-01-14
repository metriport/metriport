import type { Store, Options, IncrementResponse, ClientRateLimitInfo } from "express-rate-limit";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import {
  MetriportError,
  errorToString,
  rateLimitCountSchema,
  rateLimitThresholdSchema,
  rateLimitThresholdKey,
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
 * A `Store` that stores the hit count for each client in DynamoDB.
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
    const { log } = out("DynamoStore constructor");
    this.countPrefix = options.countPrefix ?? "count_";
    this.limitPrefix = options.limitPrefix ?? "limit_";
    if (this.countPrefix === this.limitPrefix) {
      const msg = "Conflicting prefixes in DynamoStore";
      log(msg);
      capture.error(msg, {
        extra: {
          countPrefix: this.countPrefix,
          limitPrefix: this.limitPrefix,
          context: "dynamo-store.constructor",
        },
      });
      throw new MetriportError(msg, undefined, {
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
      const msg = "Error parsing DynamoStore count entry";
      log(`${msg} - error: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          key,
          context: "dynamo-store.get",
          error,
        },
      });
      throw new MetriportError(msg, error, { method: "get", key });
    }
    return {
      totalHits: entry.data.totalHits,
      resetTime: entry.data.resetTime ? this.buildDate(entry.data.resetTime) : undefined,
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
    const now = buildDayjs().unix();
    const currentEntry = await this.get(key);
    if (currentEntry && currentEntry.resetTime && currentEntry.resetTime.getTime() < now) {
      await this.resetKey(key);
    }
    const item = await this.ddbUtils.update({
      partition: this.prefixCountKey(key),
      expression: "ADD totalHits :inc SET resetTime = if_not_exists(resetTime, :resetTime)",
      expressionAttributesValues: {
        ":inc": 1,
        ":resetTime": buildDayjs().add(this.windowMs, "milliseconds").unix(),
      },
    });
    const entry = rateLimitCountSchema.safeParse(item.Attributes);
    if (!entry.success) {
      const error = entry.error;
      const msg = "Error parsing DynamoStore count entry";
      log(`${msg} - error: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          key,
          context: "dynamo-store.increment",
          error,
        },
      });
      throw new MetriportError(msg, error, { method: "increment", key });
    }
    if (!entry.data.resetTime) {
      throw new MetriportError("resetTime not set correctly", undefined, {
        method: "increment",
        key,
      });
    }
    return {
      totalHits: entry.data.totalHits,
      resetTime: this.buildDate(entry.data.resetTime),
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
    await this.ddbUtils.update({
      partition: this.prefixCountKey(key),
      expression: "ADD totalHits :inc",
      expressionAttributesValues: {
        ":inc": -1,
      },
    });
  }

  /**
   * Method to reset a client's hit counter.
   *
   * @param key {string} - The identifier for a client.
   *
   * @public
   */
  async resetKey(key: string): Promise<void> {
    await this.ddbUtils.update({
      partition: this.prefixCountKey(key),
      expression: "SET totalHits = :totalHits REMOVE resetTime",
      expressionAttributesValues: {
        ":totalHits": 0,
      },
    });
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
    const item = await this.getOrCreateLimit(key, defaultLimit);
    const entry = rateLimitThresholdSchema.safeParse(item);
    if (!entry.success) {
      const error = entry.error;
      const msg = "Error parsing DynamoStore limit entry";
      log(`${msg} - error: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          key,
          context: "dynamo-store.getLimit",
          error,
        },
      });
      throw new MetriportError(msg, error, { method: "getLimit", key, defaultLimit });
    }
    return entry.data.limitThreshold;
  }

  async getOrCreateLimit(key: string, defaultLimit: number): Promise<DocumentClient.AttributeMap> {
    const item = await this.ddbUtils.get({ partition: this.prefixLimitKey(key) });
    if (item.Item) return item.Item;
    const limitThresholdAttribute = `:${rateLimitThresholdKey}`;
    const newItem = await this.ddbUtils.update({
      partition: this.prefixLimitKey(key),
      expression: `set ${rateLimitThresholdKey} = ${limitThresholdAttribute}`,
      expressionAttributesValues: { [limitThresholdAttribute]: defaultLimit },
    });
    if (!newItem.Attributes) {
      throw new MetriportError("Missing item attributes", undefined, {
        method: "getOrCreateLimit",
        key,
        defaultLimit,
      });
    }
    return newItem.Attributes;
  }

  buildDate(resetTime: number): Date {
    return buildDayjs(resetTime).toDate();
  }
}

// Export the store so others can use it
export default DynamoStore;
