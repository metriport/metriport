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

const partitionKey = "id";
const recordId = "1";

const cacheDuration = dayjs.duration({ minutes: 5 });

type CacheEntry = {
  record: FeatureFlagsRecord;
  timestamp: number;
};

let featureFlagsCache: CacheEntry | undefined;

function makeAppConfigClient(region: string, tableName: string): DynamoDbUtils {
  return new DynamoDbUtils({ region, table: tableName, partitionKey });
}

export const featureFlagsRecordUpdateSchema = z.object({
  featureFlags: ffDatastoreSchema,
  updatedBy: z.string(),
  version: z.number(),
});
export type FeatureFlagsRecordUpdate = z.infer<typeof featureFlagsRecordUpdateSchema>;

export const featureFlagsRecordSchema = featureFlagsRecordUpdateSchema.merge(
  z.object({
    id: z.string(),
    updatedAt: z.string(),
  })
);
export type FeatureFlagsRecord = z.infer<typeof featureFlagsRecordSchema>;

// TODO 2840 Consider removing this, or just making all FFs optional by default.
const initialFeatureFlags: FeatureFlagDatastore = {
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

const initialRecord: FeatureFlagsRecord = {
  id: recordId,
  featureFlags: initialFeatureFlags,
  updatedAt: new Date().toISOString(),
  updatedBy: "metriport",
  version: 0,
};

export async function getFeatureFlags(
  region: string,
  tableName: string
): Promise<FeatureFlagDatastore> {
  const record = await getFeatureFlagsRecord({ region, tableName });
  log(
    `From config with region=${region} and tableName=${tableName} - got config version: ${record.version}`
  );
  return record.featureFlags ?? {};
}

/**
 * Update the feature flags in the database. Kept here for backwards compatibility only.
 * @deprecated Use updateFeatureFlagsRecord instead
 */
// export async function createAndDeployConfigurationContent({
export async function updateFeatureFlags({
  region,
  tableName,
  newData,
}: {
  region: string;
  tableName: string;
  newData: FeatureFlagDatastore;
}): Promise<FeatureFlagDatastore> {
  const updatedRecord = await _update({
    region,
    tableName,
    newContent: newData,
  });
  return updatedRecord.featureFlags;
}

export async function getFeatureFlagsRecord({
  region,
  tableName,
}: {
  region: string;
  tableName: string;
}): Promise<FeatureFlagsRecord> {
  const now = Date.now();

  // If cache exists and is not expired, return cached value
  if (featureFlagsCache && now - featureFlagsCache.timestamp < cacheDuration.asMilliseconds()) {
    log(
      `Returning cached feature flags (age: ${Math.round(
        (now - featureFlagsCache.timestamp) / 1000
      )}s)`
    );
    return featureFlagsCache.record;
  }

  // Cache is expired or doesn't exist, fetch from DynamoDB
  const ddb = makeAppConfigClient(region, tableName);
  const config = await ddb.get({ partition: recordId });
  const record = ddbItemToDbRecord(config.Item);

  // Update cache
  featureFlagsCache = {
    record,
    timestamp: now,
  };

  log(`Updated feature flags cache (version: ${record.version})`);
  return record;
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
    const existingRecord = await getFeatureFlagsRecord({ region, tableName });

    if (existingRecord.version !== newRecordData.version) {
      throw new BadRequestError(`FFs out of sync, reload and try again`, undefined, {
        existingVersion: existingRecord.version,
        updateVersion: newRecordData.version,
      });
    }

    const updatedRecord = await _update({
      region,
      tableName,
      newContent: newRecordData.featureFlags,
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
}: {
  region: string;
  tableName: string;
  newContent: FeatureFlagDatastore;
}): Promise<FeatureFlagsRecord> {
  const ddbUtils = makeAppConfigClient(region, tableName);

  try {
    ffDatastoreSchema.parse(newContent);
  } catch (error) {
    throw new BadRequestError(`Invalid feature flags`, error);
  }

  const ffColumnName: keyof FeatureFlagsRecord = "featureFlags";
  const updatedAtColumnName: keyof FeatureFlagsRecord = "updatedAt";
  const updatedByColumnName: keyof FeatureFlagsRecord = "updatedBy";
  const versionColumnName: keyof FeatureFlagsRecord = "version";

  const ffReplacement = "ffs";
  const updatedAtReplacement = "updatedAt";
  const updatedByReplacement = "updatedBy";
  const zeroReplacement = "zero";
  const oneReplacement = "one";

  const response = await ddbUtils.update({
    partition: recordId,
    expression:
      `SET ` +
      `${ffColumnName} = :${ffReplacement}, ` +
      `${updatedAtColumnName} = :${updatedAtReplacement}, ` +
      `${updatedByColumnName} = :${updatedByReplacement}, ` +
      `${versionColumnName} = if_not_exists(${versionColumnName}, :zero) + :one`,
    expressionAttributesValues: {
      [`:${ffReplacement}`]: JSON.stringify(newContent),
      [`:${updatedAtReplacement}`]: new Date().toISOString(),
      [`:${updatedByReplacement}`]: "metriport",
      [`:${zeroReplacement}`]: 0,
      [`:${oneReplacement}`]: 1,
    },
    returnValue: "ALL_NEW",
  });
  const record = ddbItemToDbRecord(response.Attributes);
  log(`Updated FFs (new version: ${record.version})`);
  return record;
}

function ddbItemToDbRecord(item: DocumentClient.AttributeMap | undefined): FeatureFlagsRecord {
  if (!item) return initialRecord;
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
