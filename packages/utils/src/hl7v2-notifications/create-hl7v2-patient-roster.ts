import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Hl7v2RosterGenerator } from "@metriport/core/command/hl7v2-subscriptions/hl7v2-roster-generator";
import { makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";

const isLocal = true;
const configs = getEnvVarOrFail("HIE_CONFIGS"); // You can get this from the config files in metriport-internal repo

/**
 * This script is used to trigger the generation and upload of the HL7v2 subscription roster to the S3 bucket.
 *
 * Usage:
 * - Set the `isLocal` to specify if you want a local test or a remote Lambda invocation
 * - Set the required env vars
 * - Run the script with this command from /packages/utils: `ts-node src/hl7v2-notifications/create-hl7v2-patient-roster`
 */
async function main() {
  try {
    const config = JSON.parse(configs);
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
