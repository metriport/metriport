import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Hl7v2RosterGenerator } from "@metriport/core/command/hl7v2-subscriptions/hl7v2-roster-generator";
import { HieConfig } from "@metriport/core/command/hl7v2-subscriptions/types";
import { getLambdaResultPayload, makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { out } from "@metriport/core/util";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { sleep } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import readline from "readline/promises";
import { elapsedTimeAsStr } from "../shared/duration";

/**
 * Triggers generation and upload of HL7v2 subscription roster to S3.
 *
 * NOTE: this will include patients for all customers that have a cohort enabled for the given HIE.
 *
 * Required env vars:
 *
 * >> remote only
 * - AWS_REGION: AWS region for Lambda
 * - HL7V2_ROSTER_UPLOAD_LAMBDA_NAME: Name of Lambda function
 *
 * >> local only
 * - API_URL: Base URL of the API
 * - HL7V2_ROSTER_BUCKET_NAME: S3 bucket for roster files
 * - HL7_BASE64_SCRAMBLER_SEED: Seed for base64 scrambling
 *
 * Usage:
 * 1. Set `isLocal` flag for local vs Lambda execution
 * 2. Set `config` to one of the HieConfig object from `config/staging.ts`
 * 3. Run: `npx ts-node src/hl7v2-notifications/create-hl7v2-patient-roster`
 */

const isLocal = false;

const config: HieConfig = {} as HieConfig;

if (!config.name || !config.mapping) {
  throw new Error("Remember to set the config object! See the tsdoc for more info.");
}

async function main() {
  await sleep(50);
  const { log } = out("");

  const startedAt = Date.now();
  log(`>>> Starting at ${buildDayjs().toISOString()}...`);

  await displayWarningAndConfirmation(log);

  try {
    console.log(
      `🌲 Environment: ${isLocal ? "local" : "Lambda"}` +
        `\n🏠 Hie: ${config.name}` +
        `\n🔄 Starting HL7v2 roster generation...`
    );

    if (isLocal) {
      const apiUrl = getEnvVarOrFail("API_URL");
      const bucketName = getEnvVarOrFail("HL7V2_ROSTER_BUCKET_NAME");

      await new Hl7v2RosterGenerator(apiUrl, bucketName).execute(config);
    } else {
      const region = getEnvVarOrFail("AWS_REGION");
      const lambdaName = `Hl7v2RosterUpload-${config.name}Lambda`;
      const lambdaClient = makeLambdaClient(region);

      const result = await lambdaClient
        .invoke({
          FunctionName: lambdaName,
          InvocationType: "RequestResponse",
          Payload: JSON.stringify(config),
        })
        .promise();
      getLambdaResultPayload({ result, lambdaName: lambdaName });
    }

    console.log(`Lambda logic finished running in ${elapsedTimeAsStr(startedAt)} ms.`);
  } catch (error) {
    console.error("Something went wrong:", error);
    throw error;
  }
}

async function displayWarningAndConfirmation(log: typeof console.log) {
  const msg = `You are about to trigger the creation of a patient roster for all customers with ${config.name} enabled.`;
  log(msg);
  log("Are you sure you want to proceed?");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await rl.question("Type 'yes' to proceed: ");
  if (answer !== "yes") {
    log("Aborting...");
    process.exit(0);
  }
  rl.close();
}

main();
