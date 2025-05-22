import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Hl7v2RosterGenerator } from "@metriport/core/command/hl7v2-subscriptions/hl7v2-roster-generator";
import { HieConfig } from "@metriport/core/command/hl7v2-subscriptions/types";
import { makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { TestHieConfig } from "../../../infra/config/config-data/staging/api-infra/hie-configs";

const isLocal = true;
const config = TestHieConfig as HieConfig;

/**
 * Triggers generation and upload of HL7v2 subscription roster to S3.
 *
 * Required env vars:
 *
 * >> local only
 * - API_URL: Base URL of the API
 * - HL7V2_ROSTER_BUCKET_NAME: S3 bucket for roster files
 * - HL7_BASE64_SCRAMBLER_SEED: Seed for base64 scrambling
 *
 * >> remote only
 * - AWS_REGION: AWS region for Lambda
 * - HL7V2_ROSTER_UPLOAD_LAMBDA_NAME: Name of Lambda function
 *
 * Usage:
 * 1. Set `isLocal` flag for local vs Lambda execution
 * 2. Set `hieName` to point to a key in the HIE config
 * 3. Run: `ts-node src/hl7v2-notifications/create-hl7v2-patient-roster`
 */
async function main() {
  try {
    const startedAt = Date.now();

    if (isLocal) {
      const apiUrl = getEnvVarOrFail("API_URL");
      const bucketName = getEnvVarOrFail("HL7V2_ROSTER_BUCKET_NAME");

      await new Hl7v2RosterGenerator(apiUrl, bucketName).execute(config);
    } else {
      const region = getEnvVarOrFail("AWS_REGION");
      const lambdaName = getEnvVarOrFail("HL7V2_ROSTER_UPLOAD_LAMBDA_NAME");
      const lambdaClient = makeLambdaClient(region);

      await lambdaClient
        .invoke({
          FunctionName: lambdaName,
          InvocationType: "RequestResponse",
          Payload: JSON.stringify(config),
        })
        .promise();
    }

    const duration = Date.now() - startedAt;
    console.log(`Lambda logic finished running in ${duration} ms.`);
  } catch (error) {
    console.error("Something went wrong:", error);
    throw error;
  }
}

main();
