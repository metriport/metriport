import { BadRequestError, errorToString, MetriportError } from "@metriport/shared";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { z } from "zod";
import { InMemoryCache } from "../../cache/cache-in-memory";
import { DynamoDbUtils } from "../../external/aws/dynamodb";
import { out } from "../../util/log";
import { capture } from "../../util/notifications";
import { FeatureFlagDatastore, ffDatastoreSchema } from "./types";

dayjs.extend(duration);

const { log } = out(`FFs on DDB`);
export const partitionKey = "id";
export const sortKey = "version";
export const recordId = "1";
const cacheDuration = dayjs.duration({ minutes: 5 });

export const featureFlagsRecordUpdateSchema = z.object({
  featureFlags: ffDatastoreSchema,
  updatedBy: z.string(),
  existingVersion: z.number(),
});
export type FeatureFlagsRecordUpdate = z.infer<typeof featureFlagsRecordUpdateSchema>;

export const featureFlagsRecordSchema = featureFlagsRecordUpdateSchema
  .omit({ existingVersion: true })
  .merge(
    z.object({
      id: z.string(),
      updatedAt: z.string(),
      version: z.number(),
    })
  );
export type FeatureFlagsRecord = z.infer<typeof featureFlagsRecordSchema>;

// TODO 2840 Consider removing this, or just making all FFs optional by default.
export const initialFeatureFlags: FeatureFlagDatastore = {
  cxsWithEnhancedCoverageFeatureFlag: { enabled: false, values: [] },
  cxsWithCQDirectFeatureFlag: { enabled: false, values: [] },
  cxsWithCWFeatureFlag: { enabled: false, values: [] },
  cxsWithADHDMRFeatureFlag: { enabled: false, values: [] },
  cxsWithNoMrLogoFeatureFlag: { enabled: false, values: [] },
  cxsWithBmiMrFeatureFlag: { enabled: false, values: [] },
  cxsWithDermMrFeatureFlag: { enabled: false, values: [] },
  cxsWithAiBriefFeatureFlag: { enabled: false, values: [] },
  getCxsWithCdaCustodianFeatureFlag: { enabled: false, values: [] },
  cxsWithNoWebhookPongFeatureFlag: { enabled: false, values: [] },
  cxsWithIncreasedSandboxLimitFeatureFlag: { enabled: false, values: [] },
  cxsWithEpicEnabled: { enabled: false, values: [] },
  cxsWithDemoAugEnabled: { enabled: false, values: [] },
  cxsWithStalePatientUpdateEnabled: { enabled: false, values: [] },
  cxsWithStrictMatchingAlgorithm: { enabled: false, values: [] },
  cxsWithAthenaCustomFieldsEnabled: { enabled: false, values: [] },
  oidsWithIHEGatewayV2Enabled: { enabled: false, values: [] },
  e2eCxIds: { enabled: false, values: [] },
  commonwellFeatureFlag: { enabled: false },
  carequalityFeatureFlag: { enabled: false },
};

/**
 * Feature flags service.
 *
 * This class is responsible for fetching the feature flags from the database and caching them.
 * It also provides a method to update the feature flags in the database.
 *
 * This class is a singleton, so it can be used across the application.
 *
 * It requires initialization before being used. Call FeatureFlags.init() with the region and table name.
 */
export class FeatureFlags {
  private ddbUtils: DynamoDbUtils;
  private cache = new InMemoryCache<FeatureFlagsRecord>(
    cacheDuration.asMilliseconds(),
    FeatureFlags._getFeatureFlagsRecord
  );
  private static _instance: FeatureFlags | undefined;

  private constructor(private readonly region: string, private readonly tableName: string) {
    this.ddbUtils = makeDdbClient(this.region, this.tableName);
    FeatureFlags._instance = this;
  }

  /**
   * Initialize the feature flags service.
   * It has to be called before using the service.
   */
  public static init(region: string, tableName: string): void {
    if (!this._instance) {
      new FeatureFlags(region, tableName);
    }
  }

  private static get instance(): FeatureFlags {
    if (!FeatureFlags._instance) {
      throw new MetriportError("Feature flags not initialized");
    }
    return FeatureFlags._instance;
  }

  public static async getFeatureFlagsRecord({
    skipCache = false,
  }: {
    skipCache?: boolean;
  } = {}): Promise<FeatureFlagsRecord | undefined> {
    if (skipCache) await FeatureFlags._getFeatureFlagsRecord();
    return await FeatureFlags.instance.cache.get(recordId);
  }

  public static async updateFeatureFlagsRecord({
    newRecordData,
    skipVersionCheck = false,
  }: {
    newRecordData: FeatureFlagsRecordUpdate;
    skipVersionCheck?: boolean;
  }): Promise<FeatureFlagsRecord> {
    ffDatastoreSchema.parse(newRecordData.featureFlags);

    try {
      const existingRecord = await FeatureFlags.getFeatureFlagsRecord({ skipCache: true });

      if (
        !skipVersionCheck &&
        existingRecord &&
        existingRecord.version !== newRecordData.existingVersion
      ) {
        throw new BadRequestError(`FFs out of sync, reload and try again`, undefined, {
          existingVersion: existingRecord.version,
          updateVersion: newRecordData.existingVersion,
        });
      }
      const versionToUse = existingRecord?.version ?? 0;

      const recordUpdate: FeatureFlagsRecord = {
        id: recordId,
        featureFlags: newRecordData.featureFlags,
        version: versionToUse + 1,
        updatedBy: newRecordData.updatedBy,
        updatedAt: new Date().toISOString(),
      };
      await FeatureFlags.instance.ddbUtils._docClient
        .put({
          TableName: FeatureFlags.instance.ddbUtils._table,
          Item: recordUpdate,
          ConditionExpression: `attribute_not_exists(${partitionKey}) AND attribute_not_exists(${sortKey})`,
        })
        .promise();

      await FeatureFlags.instance.cache.set(recordId, recordUpdate);

      log(`Updated FFs (new version: ${recordUpdate.version}), by ${recordUpdate.updatedBy}`);

      return recordUpdate;
    } catch (error) {
      const msg = "Failed to update feature flags";
      const extra = {
        region: FeatureFlags.instance.region,
        tableName: FeatureFlags.instance.tableName,
        newRecordData,
        errorMessage: errorToString(error),
        error,
      };
      log(`${msg}: ${JSON.stringify(extra)}`);
      capture.error(msg, { extra });
      throw error;
    }
  }

  private static async _getFeatureFlagsRecord({
    age,
  }: {
    age?: number;
  } = {}): Promise<FeatureFlagsRecord | undefined> {
    try {
      const config = await FeatureFlags.instance.ddbUtils._docClient
        .query({
          TableName: FeatureFlags.instance.ddbUtils._table,
          KeyConditionExpression: `${partitionKey} = :id`,
          ExpressionAttributeValues: { ":id": recordId },
          ScanIndexForward: false,
          Limit: 1,
        })
        .promise();
      const record = ddbItemToDbRecord(config.Items?.[0]);
      if (!record) return undefined;

      log(`Read feature flags from DDB, version: ${record.version}, age was ${age} millis`);

      return record;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.code === "ResourceNotFoundException") {
        return undefined;
      }
      throw error;
    }
  }
}

function makeDdbClient(region: string, tableName: string): DynamoDbUtils {
  return new DynamoDbUtils({ region, table: tableName, partitionKey });
}

function ddbItemToDbRecord(
  item: DocumentClient.AttributeMap | undefined
): FeatureFlagsRecord | undefined {
  if (!item) return undefined;
  const recordRaw = item;
  const { featureFlags: featureFlagsRaw, ...rest } = recordRaw;
  const featureFlags = featureFlagsRaw
    ? typeof featureFlagsRaw === "string"
      ? ffDatastoreSchema.parse(JSON.parse(featureFlagsRaw))
      : featureFlagsRaw
    : initialFeatureFlags;
  const baseRecord = featureFlagsRecordSchema.parse({
    ...rest,
    featureFlags: initialFeatureFlags,
  });
  const record: FeatureFlagsRecord = {
    ...baseRecord,
    featureFlags,
  };
  return record;
}

/**
 * Get the feature flags from the database. Kept here for backwards compatibility only.
 * @deprecated Use FeatureFlags.getFeatureFlagsRecord instead
 */
export async function getFeatureFlags(): Promise<FeatureFlagDatastore> {
  const record = await FeatureFlags.getFeatureFlagsRecord();
  return record?.featureFlags ?? initialFeatureFlags;
}

/**
 * Update the feature flags in the database. Kept here for backwards compatibility only.
 * @deprecated Use FeatureFlags.updateFeatureFlagsRecord instead
 */
export async function updateFeatureFlags({
  newData,
}: {
  newData: FeatureFlagDatastore;
}): Promise<FeatureFlagDatastore> {
  const updatedRecord = await FeatureFlags.updateFeatureFlagsRecord({
    newRecordData: {
      featureFlags: newData,
      updatedBy: "metriport",
      existingVersion: 0,
    },
    skipVersionCheck: true,
  });
  return updatedRecord.featureFlags;
}
