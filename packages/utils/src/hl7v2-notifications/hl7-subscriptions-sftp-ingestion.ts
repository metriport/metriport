import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top

import { buildLaHieIngestion } from "@metriport/core/command/hl7v2-subscriptions/hl7-subscriptions-sftp-ingestion/hl7-subscriptions-sftp-ingestion-factory";
import { Config } from "@metriport/core/util/config";
import { sleep } from "@metriport/core/util/sleep";
import { S3Utils } from "@metriport/core/external/aws/s3";

/**
 * Runs the HL7v2 ingestion process.
 * This will SFTP into a remote server and ingest **ALL** files in the remote path if that file is not already in S3.
 * This expects PSV formated ADT files. It will convert them to HL7v2 and send them to the webhook sender.
 * The webhook sender will then store the converted FHIR resources in S3.
 *
 * Input:
 * - Requires a PGP encrypted file(s) containing PSV formatted ADT messages where:
 *   - The header row is exactly as specified in the PSV_HEADER constant. (@metriport/core/command/hl7v2-subscriptions/hl7-subscriptions-sftp-ingestion/psv-to-hl7-converter.ts)
 *   - The enviornment variables to be set(see right below this comment)
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
 * 1. Set the enviornment variables.
 * 2. Have a SFTP server with the file(s) in the remote path.
 * 3. Optionally delete the file(s) from S3 after completetion. (see line 54-55)
 * 4. Run the script using: ts-node src/hl7v2-notifications/hl7-subscriptions-sftp-ingestion.ts
 *
 * Workarounds:
 * - If you want to not use the aws secret manager you must change the logic in the lambda. (remove the getSecretValueOrFail calls)
 *   - Bottom of this file: @metriport/core/command/hl7v2-subscriptions/hl7-subscriptions-sftp-ingestion/hl7-subscriptions-sftp-ingestion-direct.ts
 * - If you want to change the cxId or patientId just add a row.forEach() row.MetriplexPatID = encodedCxIdAndPatientId(cxId, patientId);
 *   - In the "getAllRowsAsync()" function in this file: @metriport/core/command/hl7v2-subscriptions/hl7-subscriptions-sftp-ingestion/psv-to-hl7-converter.ts
 */

// May comment all Config.[...] out if you want to use the cloud version.
const port = Config.getLaHieIngestionPort();
const host = Config.getLaHieIngestionHost();
const username = Config.getLaHieIngestionUsername();
// Password should not be an ARN for local execution.
const password = Config.getLaHieIngestionLocalPassword(); //eslint-disable-line @typescript-eslint/no-unused-vars
const remotePath = Config.getLaHieIngestionRemotePath();
const bucketName = Config.getLaHieIngestionBucket();
const awsRegion = Config.getAWSRegion();
const hl7IncomingMessageBucketName = Config.getHl7IncomingMessageBucketName(); //eslint-disable-line @typescript-eslint/no-unused-vars

// Note these two should point to an actual arn in aws secret manager.
const privateKeyArn = Config.getLaHieIngestionPrivateKeyArn(); //eslint-disable-line @typescript-eslint/no-unused-vars
const privateKeyPassphraseArn = Config.getLaHieIngestionPrivateKeyPassphraseArn(); //eslint-disable-line @typescript-eslint/no-unused-vars

const deleteFiles = true; // Delete files from S3 after completetion
const fileNames: string[] = ["name.gpg"]; // List of file names to delete from S3 after completetion

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  console.log(`🌲 isLocal: ${Config.isDev()}`);
  console.log(`🌲 AWS Region (IS STAGING OR PROD): ${awsRegion}`);
  console.log(`SFTP Port: ${port}`);
  console.log(`SFTP Host: ${host}`);
  console.log(`SFTP Username: ${username}`);
  console.log(`SFTP Remote Path: ${remotePath}`);
  console.log(`SFTP Bucket Name: ${bucketName}`);
  console.log(`🔄 Starting HL7v2 ingestion in 3 seconds...`); // Give some time for user to cancel just in case.
  await sleep(3000);
  const handler = await buildLaHieIngestion();
  await handler.execute();

  if (deleteFiles) {
    const s3Utils = new S3Utils(awsRegion);
    await s3Utils.deleteFiles({
      bucket: bucketName,
      keys: getFileNames(),
    });
  }
}

function getFileNames(): string[] {
  return fileNames.map(fileName => {
    return `${remotePath}/${fileName}`.replace(/^\//, "");
  });
}

main();
