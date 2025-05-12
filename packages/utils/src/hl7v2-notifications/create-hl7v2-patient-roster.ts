import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { HieConfig, Hl7v2RosterConfig } from "@metriport/core/command/hl7v2-subscriptions/types";
import { Hl7v2Subscription } from "@metriport/core/domain/patient-settings";
import { makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { getEnvVarOrFail, USState } from "@metriport/shared";

const region = getEnvVarOrFail("AWS_REGION");
const lambdaName = getEnvVarOrFail("HL7V2_ROSTER_UPLOAD_LAMBDA_NAME");

// Not currently implemented in the lambda - but can be used for local testing
// const sftpHost = getEnvVarOrFail("SFTP_HOST");
// const sftpUsername = getEnvVarOrFail("SFTP_USERNAME");
// const sftpPassword = getEnvVarOrFail("SFTP_PASSWORD");
// const sftpPort = getEnvVarOrFail("SFTP_PORT");
// const sftpRemotePath = "./whatever-remote-path/roster.csv";

// Only used for local testing:
// const apiUrl = getEnvVarOrFail("API_URL");
// const bucketName = getEnvVarOrFail("HL7V2_ROSTER_BUCKET_NAME");

const lambdaClient = makeLambdaClient(region);
const subscriptions: Hl7v2Subscription[] = ["adt"];

/**
 * This script is used to trigger the generation and upload of the HL7v2 subscription roster to the S3 bucket.
 *
 * Usage:
 * - Set all the required env vars
 * - Run the script with this command from /packages/utils: `ts-node src/hl7v2-notifications/create-hl7v2-patient-roster`
 */

async function playground() {
  try {
    const config = getConfig();

    const startedAt = Date.now();
    // FOR LOCAL TESTING
    // generateAndUploadHl7v2Roster({ config: configs, bucketName, apiUrl });

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

function getConfig(): Hl7v2RosterConfig {
  // const sftpConfig: SftpConfig = {
  //   host: sftpHost,
  //   port: sftpPort,
  //   username: sftpUsername,
  //   password: sftpPassword,
  //   remotePath: sftpRemotePath,
  // };

  const hieConfig: HieConfig = {
    name: "RAMIL_STAGING",
    // sftpConfig,
    schema: {
      id: "ID",
      firstName: "FIRST NAME",
      lastName: "LAST NAME",
      dob: "DOB",
      genderAtBirth: "GENDER",
      "address[0].addressLine1": "STREET ADDRESS",
      "address[0].addressLine2": "STREET NUMBER",
      "address[0].city": "CITY",
      "address[0].zip": "ZIP",
      ssn: "SSN",
      phone: "PHONE",
    },
  };

  const rosterConfig: Hl7v2RosterConfig = {
    states: [USState.AL, USState.AK, USState.CA, USState.AZ],
    subscriptions,
    hieConfig: hieConfig,
  };

  return rosterConfig;
}

playground();
