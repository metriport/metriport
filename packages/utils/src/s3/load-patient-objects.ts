import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { createFolderName } from "@metriport/core/domain/filename";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { getEnvVarOrFail } from "@metriport/shared";
import { formatNumber } from "@metriport/shared/common/numbers";
import { elapsedTimeAsStr } from "../shared/duration";

/**
 * Utility download files from a patient from S3 and log duration and size.
 *
 * Usage:
 * - set the constants below
 */
const cxId = "";
const patientId = "";
const bucketName = "";
const suffixToInclude = ".xml.json";
const region = getEnvVarOrFail("AWS_REGION");

async function main() {
  const startedAt = Date.now();
  const { log } = out(``);
  const s3 = new S3Utils(region);

  log(`Processing patient...`);
  const patientPrefix = createFolderName(cxId, patientId);
  const objects = await s3.listObjects(bucketName, patientPrefix);
  const filteredObjects = objects?.filter(obj => obj.Key?.includes(suffixToInclude)) ?? [];
  const timeToList = elapsedTimeAsStr(startedAt);
  log(`Found ${filteredObjects.length} files in ${timeToList}`);

  let totalSize = 0;
  const startedAtDownload = Date.now();
  await executeAsynchronously(
    filteredObjects,
    async obj => {
      if (!obj.Key) return;
      log(`Downloading file ${obj.Key}...`);
      const contents = Buffer.from(await s3.getFileContentsAsString(bucketName, obj.Key));
      totalSize += contents.length;
    },
    { numberOfParallelExecutions: 10 }
  );
  log(`Found ${filteredObjects.length} files in ${timeToList}`);
  log(
    `Downloaded them in ${elapsedTimeAsStr(startedAtDownload)} - ${totalSize} B / ${formatNumber(
      totalSize / 1024
    )} MB`
  );
}

main();
