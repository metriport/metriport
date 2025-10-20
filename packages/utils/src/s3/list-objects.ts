import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { S3Utils } from "@metriport/core/external/aws/s3";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { buildDayjs } from "@metriport/shared/common/date";
import { out } from "@metriport/core/util/log";
import { sleep } from "@metriport/shared";
import { elapsedTimeAsStr } from "../shared/duration";

/**
 * List objects from S3.
 *
 * Set:
 * - AWS_REGION env var
 *
 * Run it:
 * - ts-node src/s3/list-objects.ts <bucketName> <filePrefix>
 * - AWS_REGION=us-east-1 ts-node src/s3/list-objects.ts <bucketName> <filePrefix>
 */
const bucketName = process.argv[2];
const filePrefix = process.argv[3];

const region = getEnvVarOrFail("AWS_REGION");

async function main() {
  await sleep(100);
  const { log } = out("");

  if (!bucketName || !filePrefix) {
    console.error(`Usage: ts-node src/s3/list-objects.ts <bucketName> <filePrefix>`);
    process.exit(1);
  }

  const startedAt = Date.now();
  log(`>>> Starting at ${buildDayjs().toISOString()}...\n`);

  const s3 = new S3Utils(region);

  console.log(`Getting files w/ prefix ${filePrefix}, bucket ${bucketName}...`);
  const objs = await s3.listObjects(bucketName, filePrefix);

  console.log(`Response (${objs?.length} files):`);
  objs?.forEach(obj => {
    console.log(`- ${obj.Key}`);
  });

  log(`\n>>> Done listing files (${objs?.length} files) in ${elapsedTimeAsStr(startedAt)}`);
}

main();
