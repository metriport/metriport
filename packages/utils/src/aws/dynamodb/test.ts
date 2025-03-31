import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import {
  FeatureFlags,
  FeatureFlagsRecordUpdate,
  initialFeatureFlags,
} from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { getEnvVarOrFail } from "@metriport/shared";

/**
 * Script to test the code that manipulates the feature flags in DynamoDB.
 *
 * Usage:
 * - IMPORTANT: set the DYNAMODB_ENDPOINT env var when running pointint to local DB
 *   It's used on DynamoDbUtils' constructor
 * - set the AWS_REGION and FEATURE_FLAGS_TABLE_NAME environment variables
 * - run the script
 *   ts-node src/aws/dynamodb/test.ts
 */

const tableName = getEnvVarOrFail("FEATURE_FLAGS_TABLE_NAME");
const region = getEnvVarOrFail("AWS_REGION");

async function main() {
  try {
    FeatureFlags.init(region, tableName);

    const value = await FeatureFlags.getFeatureFlagsRecord();
    console.log("Parameter value:", value);
    const newValue: FeatureFlagsRecordUpdate = {
      ...value,
      featureFlags: {
        ...(value?.featureFlags ?? initialFeatureFlags),
        commonwellFeatureFlag: { enabled: true },
      },
      existingVersion: value?.version ?? 0,
      updatedBy: "test",
    };
    const updatedValue = await FeatureFlags.updateFeatureFlagsRecord({
      newRecordData: newValue,
    });
    console.log("Parameter value:", updatedValue);
  } catch (error) {
    console.error("Error in main:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
