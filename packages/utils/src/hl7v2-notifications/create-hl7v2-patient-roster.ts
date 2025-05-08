import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Hl7v2RosterGenerator } from "@metriport/core/command/hl7v2-subscriptions/hl7v2-roster-generator";
import { HieConfig } from "@metriport/core/command/hl7v2-subscriptions/types";
import { makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { getEnvVarOrFail } from "../../../api/src/shared/config";

const region = getEnvVarOrFail("AWS_REGION");
const lambdaName = getEnvVarOrFail("HL7V2_ROSTER_UPLOAD_LAMBDA_NAME");
const configs = getEnvVarOrFail("HIE_CONFIGS");

// Not currently implemented in the lambda - but can be used for local testing
// const sftpHost = getEnvVarOrFail("SFTP_HOST");
// const sftpUsername = getEnvVarOrFail("SFTP_USERNAME");
// const sftpPassword = getEnvVarOrFail("SFTP_PASSWORD");
// const sftpPort = getEnvVarOrFail("SFTP_PORT");
// const sftpRemotePath = "./whatever-remote-path/roster.csv";

// Only used for local testing:
const apiUrl = getEnvVarOrFail("API_URL");
const bucketName = getEnvVarOrFail("HL7V2_ROSTER_BUCKET_NAME");

const lambdaClient = makeLambdaClient(region);

/**
 * This script is used to trigger the generation and upload of the HL7v2 subscription roster to the S3 bucket.
 *
 * Usage:
 * - Set all the required env vars
 * - Update the `hieConfig` object to indicate the end result values expected by the HIE
 * - Run the script with this command from /packages/utils: `ts-node src/hl7v2-notifications/create-hl7v2-patient-roster`
 */
async function playground() {
  try {
    const config = getConfig();

    const startedAt = Date.now();
    // FOR LOCAL TESTING
    new Hl7v2RosterGenerator(apiUrl, bucketName).execute(config);

    // FOR REMOTE TESTING
    await lambdaClient
      .invoke({
        FunctionName: lambdaName,
        InvocationType: "RequestResponse",
        Payload: JSON.stringify(config),
      })
      .promise();

    const duration = Date.now() - startedAt;
    console.log(`Lambda logic finished running in ${duration} ms.`);
  } catch (error) {
    console.error("Something went wrong:", error);
    throw error;
  }
}

function getConfig(): HieConfig {
  // const sftpConfig: SftpConfig = {
  //   host: sftpHost,
  //   port: sftpPort,
  //   username: sftpUsername,
  //   password: sftpPassword,
  //   remotePath: sftpRemotePath,
  // };

  return JSON.parse(configs);
}

playground();
