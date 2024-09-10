import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { S3Utils } from "@metriport/core/external/aws/s3";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { getEnvVarOrFail } from "@metriport/shared";
import AWS from "aws-sdk";
import { elapsedTimeAsStr } from "../shared/duration";
import { processSingleOutput } from "./validate/process-single-output";

/**
 * Script used to parse the output of AWS Healthlake and list the issues found there.
 *
 * To use this script, set the environment vars:
 * - HEATHLAKE_BUCKET_NAME: the S3 bucket name
 * - HEATHLAKE_FAILURE_PREFIX: the S3 prefix where the output files are stored
 * - AWS_REGION: the AWS region
 */

const prefix = getEnvVarOrFail("HEATHLAKE_FAILURE_PREFIX");
const bucketName = getEnvVarOrFail("HEATHLAKE_BUCKET_NAME");
const region = getEnvVarOrFail("AWS_REGION");

const suffixToInclude = ".ndjson";

async function main() {
  const startedAt = Date.now();
  console.log(`########################## Started at ${new Date(startedAt).toISOString()}`);

  const s3 = new S3Utils(region);
  const objects = await s3.listObjects(bucketName, prefix);
  const filteredObjects = objects?.filter(obj => obj.Key?.includes(suffixToInclude)) ?? [];

  console.log(`Got ${filteredObjects.length} files to process.`);

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
    await processSingleOutput({
      key,
      bucketName,
      errors: uniqueErrors,
      warnings: uniqueWarnings,
      infos: uniqueInfos,
      log,
    });
  }

  await executeAsynchronously(filteredObjects, processSingleObject, {
    numberOfParallelExecutions: 10,
  });

  console.log(`Errors found:\n`, uniqueErrors);
  console.log(`Warnings found:\n`, uniqueWarnings);
  console.log(`Infos found:\n`, uniqueInfos);

  console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
}

main();
