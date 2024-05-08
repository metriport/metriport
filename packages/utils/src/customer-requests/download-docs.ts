import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { createFilePath } from "@metriport/core/domain/filename";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import { errorToString } from "@metriport/shared/common/error";
import { formatNumber } from "@metriport/shared/common/numbers";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import path from "path";
import { getCxData } from "../shared/get-cx-data";
import { getFileNameForOrg } from "../shared/folder";

dayjs.extend(duration);

/**
 * Utility to download all of customer patients's docs from S3 into local.
 *
 * This will:
 *    - create a new folder in the "runs" dir for the customer, with "documents" as prefix
 *    - get all patient's docs from S3 (excluding the ones with `excludeFilter`)
 *    - store them under the package's `./runs/documents/...`
 *
 * Update the respective env variables and run `npm run download-docs`
 */

/**
 * List of patients to download S3.
 */
const patientIds: string[] = [];
const excludeFilter = "_MR";

const cxId = getEnvVarOrFail("CX_ID");
const region = getEnvVarOrFail("AWS_REGION");
const bucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");

const getDirName = (orgName: string) => `./runs/documents/${getFileNameForOrg(orgName)}`;

async function main() {
  console.log(
    `########################## Running for cx ${cxId}, ${
      patientIds.length
    } patients... - started at ${new Date().toISOString()}`
  );
  const startedAt = Date.now();

  const { orgName } = await getCxData(cxId, undefined, false);
  const dirName = getDirName(orgName);
  fs.mkdirSync(`${dirName}`, { recursive: true });
  console.log(`Storing files on dir ${dirName}`);

  await executeAsynchronously(
    patientIds,
    async (patientId: string) => {
      const log = out(`${new Date().toISOString()} [${patientId}]`).log;
      const patientStartedAt = Date.now();
      try {
        log(`>>> Getting data...`);
        await downloadDocsFor(patientId, dirName, log);
        const timeToGetData = Date.now() - patientStartedAt;
        log(`... Patient is done in ${timeToGetData}ms.`);
      } catch (error) {
        log(`Error downloading data: ${errorToString(error)}`);
      }
    },
    { numberOfParallelExecutions: 10 }
  );
  const duration = Date.now() - startedAt;
  const durationMin = formatNumber(dayjs.duration(duration).asMinutes());
  console.log(`>>> Done all patients in ${Date.now() - startedAt} ms / ${durationMin} min`);
}

async function downloadDocsFor(
  patientId: string,
  dirName: string,
  log = console.log
): Promise<void> {
  const s3Client = new S3Utils(region);
  const s3FilePrefix = createFilePath(cxId, patientId, "");
  const objects = await s3Client.listObjects(bucketName, s3FilePrefix);
  const filteredObjects = objects?.filter(obj => !obj.Key?.includes(excludeFilter)) ?? [];
  for (const object of filteredObjects) {
    const objName = object.Key;
    if (!objName) {
      log(`No object name, skipping...`);
      continue;
    }
    log(`Downloading ${objName}...`);
    const { folderName, fileName } = getFilename(objName, dirName);
    if (!fileName) {
      log(`No fileName, skipping...`);
      continue;
    }
    if (folderName) {
      if (!fs.existsSync(folderName)) fs.mkdirSync(folderName, { recursive: true });
    }
    const filePath = path.join(folderName ?? "", fileName);
    fs.openSync(filePath, "w");
    const writeStream = fs.createWriteStream(filePath, { flags: "a+" });
    await s3Client.getFileContentsIntoStream(bucketName, objName, writeStream);
  }
}

function getFilename(
  s3Key: string,
  dirName: string
): { folderName: string | undefined; fileName: string | undefined } {
  const parts = s3Key.split("/");

  const fileNameAtS3 = parts.at(-1);
  if (!fileNameAtS3) return { folderName: undefined, fileName: undefined };

  const folderName = parts.at(parts.length - 2);
  if (parts.length < 2 || !folderName) return { folderName: dirName, fileName: fileNameAtS3 };

  return { folderName: path.join(dirName, folderName), fileName: fileNameAtS3 };
}

main();
