import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import {
  getFeatureFlagsRecord,
  updateFeatureFlagsRecord,
} from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { getEnvVarOrFail } from "@metriport/shared";

/**
 * Script to test the code that manipulates the feature flags in DynamoDB.
 *
 * Usage:
 * - set the AWS_REGION and FEATURE_FLAGS_TABLE_NAME environment variables
 * - run the script
 *   ts-node src/aws/dynamodb/test.ts
 */

const tableName = getEnvVarOrFail("FEATURE_FLAGS_TABLE_NAME");
const region = getEnvVarOrFail("AWS_REGION");

async function main() {
  try {
    const value = await getFeatureFlagsRecord({ region, tableName });
    console.log("Parameter value:", value);
    const newValue = {
      ...value,
      featureFlags: {
        ...value.featureFlags,
        commonwellFeatureFlag: { enabled: true },
      },
    };
    const updatedValue = await updateFeatureFlagsRecord({
      region,
      tableName,
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
