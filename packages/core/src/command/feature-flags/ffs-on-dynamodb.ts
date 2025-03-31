import { BadRequestError } from "@metriport/shared";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { z } from "zod";
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

type CacheEntry = {
  record: FeatureFlagsRecord;
  timestamp: number;
};

let featureFlagsCache: CacheEntry | undefined;

function makeDdbClient(region: string, tableName: string): DynamoDbUtils {
  return new DynamoDbUtils({ region, table: tableName, partitionKey });
}

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
  cxsUsingWkhtmltopdfInsteadOfPuppeteer: { enabled: false, values: [] },
  cxsWithAthenaCustomFieldsEnabled: { enabled: false, values: [] },
  oidsWithIHEGatewayV2Enabled: { enabled: false, values: [] },
  e2eCxIds: { enabled: false, values: [] },
  commonwellFeatureFlag: { enabled: false },
  carequalityFeatureFlag: { enabled: false },
};

export async function getFeatureFlags(
  region: string,
  tableName: string
): Promise<FeatureFlagDatastore> {
  const record = await getFeatureFlagsRecord({ region, tableName });
  log(
    `From config with region=${region} and tableName=${tableName} - got version: ${record?.version}`
  );
  return record?.featureFlags ?? initialFeatureFlags;
}

/**
 * Update the feature flags in the database. Kept here for backwards compatibility only.
 * @deprecated Use updateFeatureFlagsRecord instead
 */
export async function updateFeatureFlags({
  region,
  tableName,
  newData,
}: {
  region: string;
  tableName: string;
  newData: FeatureFlagDatastore;
}): Promise<FeatureFlagDatastore> {
  const existingRecord = await getFeatureFlagsRecord({ region, tableName, skipCache: true });

  const updatedRecord = await _update({
    region,
    tableName,
    newContent: newData,
    updatedBy: "metriport",
    existingVersion: existingRecord?.version ?? 0,
  });
  return updatedRecord.featureFlags;
}

export async function getFeatureFlagsRecord({
  region,
  tableName,
  skipCache,
}: {
  region: string;
  tableName: string;
  skipCache?: boolean;
}): Promise<FeatureFlagsRecord | undefined> {
  const now = Date.now();

  // If cache exists and is not expired, return cached value
  if (
    !skipCache &&
    featureFlagsCache &&
    now - featureFlagsCache.timestamp < cacheDuration.asMilliseconds()
  ) {
    log(
      `Returning cached feature flags (age: ${Math.round(
        (now - featureFlagsCache.timestamp) / 1000
      )}s)`
    );
    return featureFlagsCache.record;
  }

  // Cache is expired or doesn't exist, fetch from DynamoDB
  const ddb = makeDdbClient(region, tableName);
  try {
    const config = await ddb._docClient
      .query({
        TableName: ddb._table,
        KeyConditionExpression: `${partitionKey} = :id`,
        ExpressionAttributeValues: { ":id": recordId },
        ScanIndexForward: false,
        Limit: 1,
      })
      .promise();
    const record = ddbItemToDbRecord(config.Items?.[0]);
    if (!record) return undefined;

    // Update cache
    featureFlagsCache = {
      record,
      timestamp: now,
    };
    log(`Updated feature flags cache (updatedAt: ${record.updatedAt})`);

    return record;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.code === "ResourceNotFoundException") {
      return undefined;
    }
    throw error;
  }
}

export async function updateFeatureFlagsRecord({
  region,
  tableName,
  newRecordData,
}: {
  region: string;
  tableName: string;
  newRecordData: FeatureFlagsRecordUpdate;
}): Promise<FeatureFlagsRecord> {
  try {
    const existingRecord = await getFeatureFlagsRecord({ region, tableName, skipCache: true });

    if (existingRecord && existingRecord.version !== newRecordData.existingVersion) {
      throw new BadRequestError(`FFs out of sync, reload and try again`, undefined, {
        existingVersion: existingRecord.version,
        updateVersion: newRecordData.existingVersion,
      });
    }

    const updatedRecord = await _update({
      region,
      tableName,
      newContent: newRecordData.featureFlags,
      updatedBy: newRecordData.updatedBy,
      existingVersion: newRecordData.existingVersion,
    });

    // Update cache with new record
    featureFlagsCache = {
      record: updatedRecord,
      timestamp: Date.now(),
    };

    return updatedRecord;
  } catch (error) {
    const msg = "Failed to update feature flags";
    const extra = {
      region,
      tableName,
      newRecordData,
      error,
    };
    log(`${msg}: ${JSON.stringify(extra)}`);
    capture.error(msg, { extra });
    throw error;
  }
}

async function _update({
  region,
  tableName,
  newContent,
  updatedBy,
  existingVersion,
}: {
  region: string;
  tableName: string;
  newContent: FeatureFlagDatastore;
  updatedBy: string;
  existingVersion: number;
}): Promise<FeatureFlagsRecord> {
  const ddbUtils = makeDdbClient(region, tableName);

  ffDatastoreSchema.parse(newContent);

  const record: FeatureFlagsRecord = {
    id: recordId,
    featureFlags: newContent,
    version: existingVersion + 1,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
  await ddbUtils._docClient
    .put({
      TableName: ddbUtils._table,
      Item: record,
      ConditionExpression: `attribute_not_exists(${partitionKey}) AND attribute_not_exists(${sortKey})`,
    })
    .promise();

  log(`Updated FFs (new version: ${record.version}), by ${updatedBy}`);
  return record;
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
