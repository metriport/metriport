import { BadRequestError } from "@metriport/shared";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { z } from "zod";
import { FeatureFlagDatastore, ffDatastoreSchema } from "../../external/aws/app-config";
import { DynamoDbUtils } from "../../external/aws/dynamodb";
import { out } from "../../util/log";
import { capture } from "../../util/notifications";

const { log } = out(`FFs on DDB`);

export const partitionKey = "id";
export const sortKey = "updatedAt";
const recordId = "1";

function makeAppConfigClient(region: string, tableName: string): DynamoDbUtils {
  return new DynamoDbUtils({ region, table: tableName, partitionKey });
}

export const featureFlagsRecordUpdateSchema = z.object({
  featureFlags: ffDatastoreSchema,
  updatedBy: z.string(),
  updatedAt: z.string(),
});
export type FeatureFlagsRecordUpdate = z.infer<typeof featureFlagsRecordUpdateSchema>;

export const featureFlagsRecordSchema = featureFlagsRecordUpdateSchema.merge(
  z.object({
    id: z.string(),
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
};

export async function getFeatureFlags(
  region: string,
  ffTableName: string
): Promise<FeatureFlagDatastore> {
  const record = await getFeatureFlagsRecord({ region, tableName: ffTableName });
  log(
    `From config with region=${region} and tableName=${ffTableName} - got updatedAt: ${record.updatedAt}`
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
    updatedBy: "metriport",
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
  const ddb = makeAppConfigClient(region, tableName);
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
    return record;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.code === "ResourceNotFoundException") {
      return initialRecord;
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
    const existingRecord = await getFeatureFlagsRecord({ region, tableName });

    if (existingRecord.updatedAt !== newRecordData.updatedAt) {
      throw new BadRequestError(`FFs out of sync, reload and try again`, undefined, {
        existingUpdatedAt: existingRecord.updatedAt,
        updateUpdatedAt: newRecordData.updatedAt,
      });
    }

    const updatedRecord = await _update({
      region,
      tableName,
      newContent: newRecordData.featureFlags,
      updatedBy: newRecordData.updatedBy,
    });

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
}: {
  region: string;
  tableName: string;
  newContent: FeatureFlagDatastore;
  updatedBy: string;
}): Promise<FeatureFlagsRecord> {
  const ddbUtils = makeAppConfigClient(region, tableName);

  try {
    ffDatastoreSchema.parse(newContent);
  } catch (error) {
    throw new BadRequestError(`Invalid feature flags`, error);
  }

  const record = {
    id: recordId,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy,
    featureFlags: newContent,
  };
  await ddbUtils._docClient
    .put({
      TableName: ddbUtils._table,
      Item: record,
    })
    .promise();

  log(`Updated FFs, updatedAt: ${record.updatedAt}, by ${updatedBy}`);
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
