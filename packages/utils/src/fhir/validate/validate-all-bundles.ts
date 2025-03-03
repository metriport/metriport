import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import {
  DescribeFHIRImportJobCommand,
  HealthLakeClient,
  JobStatus,
  StartFHIRImportJobCommand,
} from "@aws-sdk/client-healthlake";
import { Bundle } from "@medplum/fhirtypes";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { bundleToNdjson } from "@metriport/core/external/fhir/export/fhir-to-ndjson";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { getEnvVarOrFail, sleep } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { nanoid } from "nanoid";
import { elapsedTimeAsStr } from "../../shared/duration";
import { getFileContents, getFileNames, makeDir } from "../../shared/fs";
import { processSingleOutput } from "./process-single-output";

dayjs.extend(duration);

/**
 * Script to upload bundles from a local folder to S3 and then import them into Healthlake.
 *
 * The script will wait for the import job to complete and then process the output.
 *
 * The output is a list of unique errors, warnings and infos found in the import, and it's
 * saved in the "runs/fhir-validation" folder. The actual output from Healthlake is also stored
 * in the same folder.
 *
 * To run this script, set the following environment variables:
 * - AWS_REGION: the AWS region
 * - HEATHLAKE_DATASTORE_ID: the Healthlake Datastore ID
 * - HEATHLAKE_BUCKET_NAME: the name of the S3 bucket where the bundles and output will be stored
 * - HEALTHLAKE_KMS_KEY_ID: the KMS key ID
 * - HEALTHLAKE_ACCESS_ROLE_ARN: the access role ARN
 *
 * ...and the samplesFolderPath to the folder containing the FHIR bundles.
 */
const samplesFolderPath = "";

const datastoreId = getEnvVarOrFail("HEATHLAKE_DATASTORE_ID");
const region = getEnvVarOrFail("AWS_REGION");
const sourceBucketName = getEnvVarOrFail("HEATHLAKE_BUCKET_NAME");
const destinationBucketName = getEnvVarOrFail("HEATHLAKE_BUCKET_NAME");
const kmsKeyId = getEnvVarOrFail("HEALTHLAKE_KMS_KEY_ID");
const accesRoleArn = getEnvVarOrFail("HEALTHLAKE_ACCESS_ROLE_ARN");

const bundleExtensionToInclude = "_deduped.json";
const sourcePrefix = `source/` + dayjs().toISOString();
const destinationPrefix = "import-output";
const maxFhirImportStatusChecks = 100;
const waitBetweenChecks = dayjs.duration({ seconds: 5 });

const healthlake = new HealthLakeClient({ region });
const s3 = new S3Utils(region);

const timestamp = dayjs().toISOString();
const outputFolderName = `runs/fhir-validation/${timestamp}`;

makeDir(outputFolderName);

export async function main() {
  await sleep(50); // just to make sure the logs are in not mixed up with Node's and other libs'
  const startedAt = Date.now();
  console.log(`########################## Started at ${new Date(startedAt).toISOString()}`);

  await uploadBundlesToS3();
  const uploadCompletedAt = Date.now();

  const jobId = await startImportJob();

  await waitForImportJobToComplete(jobId);
  const importCompletedAt = Date.now();

  await processImportJobOutput(jobId);

  console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
  console.log(`... upload to S3 in ${elapsedTimeAsStr(startedAt, uploadCompletedAt)}`);
  console.log(
    `... import into Healthlake in ${elapsedTimeAsStr(uploadCompletedAt, importCompletedAt)}`
  );
}

async function uploadBundlesToS3() {
  const bundleFileNames = getFileNames({
    folder: samplesFolderPath,
    recursive: true,
    extension: "json",
  });
  const filteredBundleNames = bundleFileNames.filter(fileName =>
    fileName.includes(bundleExtensionToInclude)
  );
  console.log(`Found ${filteredBundleNames.length} files. Uploading to S3...`);
  await executeAsynchronously(filteredBundleNames, uploadToS3, {
    numberOfParallelExecutions: 1,
  });
  console.log(`Upload done.`);
}

async function uploadToS3(filePath: string) {
  // convert them to NDJSON in memory
  const stringBundle = getFileContents(filePath);
  const bundle = JSON.parse(stringBundle) as Bundle;
  const bundleAsNdjson = bundleToNdjson(bundle);
  // upload them to S3
  const lastSlash = filePath.lastIndexOf("/");
  const fileName = filePath.slice(lastSlash + 1).replace(".json", ".ndjson");
  const sourceKeyName = `${sourcePrefix}/${fileName}`;
  await s3.uploadFile({
    bucket: sourceBucketName,
    key: sourceKeyName,
    content: Buffer.from(bundleAsNdjson),
  });
}

async function startImportJob(): Promise<string> {
  const clientToken = nanoid().replace(/[^a-zA-Z]/g, "");
  const startFhirImportCmd = new StartFHIRImportJobCommand({
    InputDataConfig: {
      S3Uri: `s3://${sourceBucketName}/${sourcePrefix}`,
    },
    JobOutputDataConfig: {
      S3Configuration: {
        S3Uri: `s3://${destinationBucketName}/${destinationPrefix}`,
        KmsKeyId: kmsKeyId,
      },
    },
    DatastoreId: datastoreId,
    DataAccessRoleArn: accesRoleArn,
    ClientToken: clientToken,
  });
  console.log(`Starting import job...`);
  const response = await healthlake.send(startFhirImportCmd);
  const jobId = response.JobId;
  if (!jobId) throw new Error(`No job ID returned from import job start`);
  console.log(`Import job started:`, response);
  return jobId;
}

async function waitForImportJobToComplete(jobId: string): Promise<void> {
  const describeFhirImportCmd = new DescribeFHIRImportJobCommand({
    DatastoreId: datastoreId,
    JobId: jobId,
  });
  let status: JobStatus = "IN_PROGRESS";
  let attempts = 0;
  console.log(`Waiting for import job to complete...`);
  while (!isStatusFinal(status)) {
    const importDesc = await healthlake.send(describeFhirImportCmd);
    status = importDesc.ImportJobProperties?.JobStatus ?? "IN_PROGRESS";
    if (isStatusFinal(status)) {
      console.log(`Import job ${jobId} completed with status: ${status}`);
      break;
    }
    if (attempts++ >= maxFhirImportStatusChecks) {
      throw new Error(`Import job ${jobId} did not complete after ${attempts} checks`);
    }
    console.log(
      `Import job ${jobId} has status: ${status}, waiting for ${waitBetweenChecks.asSeconds()} seconds and checking again...`
    );
    await sleep(waitBetweenChecks.asMilliseconds());
  }
}

function isStatusFinal(status: JobStatus): boolean {
  const finalStatuses = [
    "CANCEL_COMPLETED",
    "CANCEL_FAILED",
    "CANCEL_IN_PROGRESS",
    "CANCEL_SUBMITTED",
    "COMPLETED",
    "COMPLETED_WITH_ERRORS",
    "FAILED",
  ];
  return finalStatuses.includes(status);
}

async function processImportJobOutput(jobId: string, failureOnly = true): Promise<void> {
  const outputPrefix =
    `${destinationPrefix}/${datastoreId}-FHIR_IMPORT-${jobId}/` + (failureOnly ? "FAILURE/" : "");

  const objects = await s3.listObjects(destinationBucketName, outputPrefix);
  if (!objects || !objects.length) {
    console.log(`WARN: No files found in ${outputPrefix}`);
    return;
  }

  console.log(
    `Got ${objects.length} files to process (output from the import). Going through them...`
  );

  const uniqueErrors: Map<string, number> = new Map();
  const uniqueWarnings: Map<string, number> = new Map();
  const uniqueInfos: Map<string, number> = new Map();

  let index = 0;
  async function processSingleObject(object: AWS.S3.Object) {
    const { log } = out(`${++index}`);
    const key = object.Key;
    if (!key) {
      log(`No object name, skipping...`);
      return;
    }
    const contents = await processSingleOutput({
      key,
      bucketName: destinationBucketName,
      errors: uniqueErrors,
      warnings: uniqueWarnings,
      infos: uniqueInfos,
      log,
    });
    const fileName = key.slice(key.lastIndexOf("/") + 1);
    fs.writeFileSync(`./${outputFolderName}/${fileName}`, contents);
  }

  await executeAsynchronously(objects, processSingleObject, {
    numberOfParallelExecutions: 10,
  });

  console.log(`Errors found:\n`, uniqueErrors);
  console.log(`Warnings found:\n`, uniqueWarnings);
  console.log(`Infos found:\n`, uniqueInfos);

  fs.writeFileSync(`./${outputFolderName}/_errors.txt`, mapToString(uniqueErrors));
  fs.writeFileSync(`./${outputFolderName}/_warnings.txt`, mapToString(uniqueWarnings));
  fs.writeFileSync(`./${outputFolderName}/_infos.txt`, mapToString(uniqueInfos));
}

function mapToString(map: Map<string, number>): string {
  return Array.from(map.entries())
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

main();
