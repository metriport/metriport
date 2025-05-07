import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
// import { Hl7v2RosterGenerator } from "@metriport/core/command/hl7v2-subscriptions/hl7v2-roster-generator";
import {
  // HieConfig,
  HieName,
  Hl7v2RosterConfig,
  hieNames,
} from "@metriport/core/command/hl7v2-subscriptions/types";
import { Hl7v2Subscription } from "@metriport/core/domain/patient-settings";
import { makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { USState } from "@metriport/shared";
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
// const apiUrl = getEnvVarOrFail("API_URL");
// const bucketName = getEnvVarOrFail("HL7V2_ROSTER_BUCKET_NAME");

const lambdaClient = makeLambdaClient(region);
const subscriptions: Hl7v2Subscription[] = ["adt"];
const hieName = "HTX";

/**
 * This script is used to trigger the generation and upload of the HL7v2 subscription roster to the S3 bucket.
 *
 * Usage:
 * - Set all the required env vars
 * - Update the `hieConfig` object to indicate the end result values expected by the HIE
 * - Run the script with this command from /packages/utils: `ts-node src/hl7v2-notifications/create-hl7v2-patient-roster`
 */
const asd = {
  HTX: {
    name: "HTX",
    id: "ID",
    firstName: "FIRST NAME",
    lastName: "LAST NAME",
    dob: "DOB",
    genderAtBirth: "GENDER",
    ssn: "SSN",
    phone: "PHONE",
    address: [
      {
        addressLine1: "STREET ADDRESS",
        addressLine2: "STREET NUMBER",
        city: "CITY",
        zip: "ZIP",
      },
    ],
  },
};

async function playground() {
  try {
    console.log(JSON.stringify(asd));
    const config = getConfig();

    const startedAt = Date.now();
    // FOR LOCAL TESTING
    // new Hl7v2RosterGenerator(apiUrl, bucketName).execute({ config, hieName: getHieName(hieName) });

    // FOR REMOTE TESTING
    await lambdaClient
      .invoke({
        FunctionName: lambdaName,
        InvocationType: "RequestResponse",
        Payload: JSON.stringify({ config, hieName: getHieName(hieName) }),
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

  const hieConfigs = JSON.parse(configs);
  const rosterConfig: Hl7v2RosterConfig = {
    states: [USState.AL, USState.AK, USState.CA, USState.AZ],
    subscriptions,
    hieConfigs,
  };

  return rosterConfig;
}

function getHieName(name: string): HieName {
  if (!name) {
    throw new Error("HIE name is not specified!");
  }
  if (!hieNames.includes(name as HieName)) {
    throw new Error(`Invalid HIE name. Must be one of: ${hieNames.join(", ")}`);
  }
  return name as HieName;
}

playground();
