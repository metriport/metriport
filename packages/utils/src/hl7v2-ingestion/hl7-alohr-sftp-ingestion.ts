import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top

import { buildHl7AlohrSftpIngestion } from "@metriport/core/command/hl7-sftp-ingestion/alohr/hl7-alohr-sftp-ingestion-factory";
import { Config } from "@metriport/core/util/config";
import { sleep } from "@metriport/core/util/sleep";
import { S3Utils } from "@metriport/core/external/aws/s3";

/**
 * Runs the HL7v2 ingestion process.
 * This will SFTP into a remote server and ingest all files in the remote path between the starting and ending dates if that file is not already in S3.
 * It will then send these messages to the webhook sender will then store the converted FHIR resources in S3.
 *
 * Input:
 * - Requires
 *   - The enviornment variables to be set(see right below this comment)
 *
 * Process:
 * - Syncs the file(s) from remote server to s3.
 * - Stores the file(s) in S3.
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
 * 2. Set the startingDate and endingDate to the date you want to ingest.
 * 3. Have a SFTP server with the file(s) in the remote path.
 * 4. Optionally delete the file(s) from S3 after completetion. (see line 54-55)
 * 5. Run the script using: ts-node src/hl7v2-ingestion/hl7-alohr-sftp-ingestion.ts
 *
 */

// May comment out all local or cloud configs depending on which enviornment you want to run.

////// LOCAL //////
const sftpConfig = Config.getAlohrIngestionSftpConfig();
const port = sftpConfig.port;
const host = sftpConfig.host;
const username = sftpConfig.username;
const remotePath = Config.getAlohrIngestionRemotePath();
const bucketName = Config.getAlohrIngestionBucket();
const awsRegion = Config.getAWSRegion();
Config.getHl7IncomingMessageBucketName();
Config.getAlohrIngestionLambdaName();

// Note this should point to an actual arn in aws secret manager. (Or use the local only password)
Config.getAlohrIngestionPasswordArn();

////// CLOUD //////
Config.getAlohrIngestionLambdaName();

/// GENERAL /////
Config.getEnvType();

const startingDate = ""; // YYYYMMDD INCLUSIVE
const endingDate = ""; // YYYYMMDD EXCLUSIVE
const password = ""; // Password to use for the SFTP client. ONLY WORKS LOCALLY.
const deleteFiles = false; // Delete files from S3 after completetion
const fileNames: string[] = [""]; // List of file names to delete from S3 after completetion

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
  try {
    const handler = await buildHl7AlohrSftpIngestion(password);
    await handler.execute({ startingDate, endingDate });
  } finally {
    await optionallyDeleteFiles();
  }
  F;
}

async function optionallyDeleteFiles() {
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
