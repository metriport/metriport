import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top

import { buildHl7LahieSftpIngestion } from "@metriport/core/command/hl7-sftp-ingestion/hl7-sftp-ingestion-factory";
import { Config } from "@metriport/core/util/config";
import { sleep } from "@metriport/core/util/sleep";

/**
 * Runs the HL7v2 ingestion process.
 * This will SFTP into a remote server and ingest **ALL** files in the remote path if that file is not already in S3.
 * This expects PSV formated ADT files. It will convert them to HL7v2 and send them to the webhook sender.
 * The webhook sender will then store the converted FHIR resources in S3.
 *
 * Input:
 * - On local, requires a PGP encrypted file(s) containing PSV formatted ADT messages where:
 *   - The header row is exactly as specified in the PSV_HEADER constant. (@metriport/core/command/hl7-sftp-ingestion/psv-to-hl7-converter.ts)
 *   - The enviornment variables to be set(see right below this comment)
 * - On cloud, requires the lambda name to be set(see right below this comment)
 *
 * Process:
 * - Syncs the file(s) from remote server to s3.
 * - Decrypts the file(s) using the private key.
 * - Stores the decrypted file(s) in S3.
 * - Splits the input PSV file(s) into multiple individual HL7 messages (each row is a message)
 * - For each message:
 *   - Sends to webhook sender to be converted to FHIR and stored in S3.
 *
 * Output:
 * - Uploads converted FHIR resources to specified S3 bucket
 *
 * Required Environment Variables:
 * - See below.
 *
 * Usage:
 * 1. Set the environment variables.
 * 2. Have a SFTP server with the file(s) in the remote path.
 * 3. Run the script using: npx ts-node src/hl7v2-ingestion/ingest-lahie-adts.ts
 *
 * Workarounds:
 * - If you want to not use the aws secret manager you must change the logic in the lambda. (remove the getSecretValueOrFail calls)
 *   - Bottom of this file: @metriport/core/command/hl7-sftp-ingestion/hl7-sftp-ingestion-direct.ts
 */

const awsRegion = Config.getAWSRegion();
const isLocal = Config.getEnvType() === Config.DEV_ENV;

// !!(Runs a contains so this might do multiple files at a time)!!
const filename = ""; // usually done by YYYY_MM_DD but can actually be any filename.

async function main() {
  console.log(`🌲 isLocal: ${isLocal}`);
  if (isLocal) {
    await runLocal();
  } else {
    await runCloud();
  }
}

async function runLocal() {
  const port = Config.getLahieIngestionPort();
  const host = Config.getLahieIngestionHost();
  const username = Config.getLahieIngestionUsername();

  // Password to use for the SFTP client. ONLY WORKS LOCALLY.
  const password = "";

  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  console.log(`🌲 AWS Region (IS STAGING OR PROD): ${awsRegion}`);
  console.log(`SFTP Port: ${port}`);
  console.log(`SFTP Host: ${host}`);
  console.log(`SFTP Username: ${username}`);
  console.log(`🔄 Starting HL7v2 ingestion in 3 seconds...`);
  await sleep(3000);

  const handler = await buildHl7LahieSftpIngestion(password);
  await handler.execute({ dateTimestamp: filename });
}

async function runCloud() {
  const lambdaName = Config.getLahieIngestionLambdaName();

  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  console.log(`🌲 AWS Region (IS STAGING OR PROD): ${awsRegion}`);
  console.log(`Lambda Name: ${lambdaName}`);
  console.log(`🔄 Starting HL7v2 ingestion in 3 seconds...`);
  await sleep(3000);

  const handler = await buildHl7LahieSftpIngestion(undefined);
  await handler.execute({ dateTimestamp: filename });
}

main();
