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
  cxsWithAthenaCustomFieldsEnabled: { enabled: false, values: [] },
  oidsWithIHEGatewayV2Enabled: { enabled: false, values: [] },
  e2eCxIds: { enabled: false, values: [] },
  commonwellFeatureFlag: { enabled: false },
  carequalityFeatureFlag: { enabled: false },
};

/**
 * Get the feature flags from the database. Kept here for backwards compatibility only.
 * @deprecated Use getFeatureFlagsRecord instead
 */
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
  const updatedRecord = await updateFeatureFlagsRecord({
    region,
    tableName,
    newRecordData: {
      featureFlags: newData,
      updatedBy: "metriport",
      existingVersion: 0,
    },
    skipVersionCheck: true,
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
  const age = now - (featureFlagsCache?.timestamp ?? 0);

  if (!skipCache && featureFlagsCache && age < cacheDuration.asMilliseconds()) {
    return featureFlagsCache.record;
  }

  log(`Fetching feature flags from DDB (age: ${age} millis)`);

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

    featureFlagsCache = { record, timestamp: now };
    log(`Updated feature flags cache (version: ${record.version})`);

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
  skipVersionCheck = false,
}: {
  region: string;
  tableName: string;
  newRecordData: FeatureFlagsRecordUpdate;
  skipVersionCheck?: boolean;
}): Promise<FeatureFlagsRecord> {
  ffDatastoreSchema.parse(newRecordData.featureFlags);

  try {
    const existingRecord = await getFeatureFlagsRecord({ region, tableName, skipCache: true });

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
    const ddbUtils = makeDdbClient(region, tableName);
    await ddbUtils._docClient
      .put({
        TableName: ddbUtils._table,
        Item: recordUpdate,
        ConditionExpression: `attribute_not_exists(${partitionKey}) AND attribute_not_exists(${sortKey})`,
      })
      .promise();

    featureFlagsCache = { record: recordUpdate, timestamp: Date.now() };

    log(`Updated FFs (new version: ${recordUpdate.version}), by ${recordUpdate.updatedBy}`);

    return recordUpdate;
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
