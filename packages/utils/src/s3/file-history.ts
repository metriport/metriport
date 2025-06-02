import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { HeadObjectCommand, ListObjectVersionsCommand } from "@aws-sdk/client-s3";
import { createFilePath } from "@metriport/core/domain/filename";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getEnvVarOrFail, sleep } from "@metriport/shared";
import dayjs from "dayjs";
import fs from "fs";
import { groupBy } from "lodash";
import { elapsedTimeAsStr } from "../shared/duration";
import { makeDir } from "../shared/fs";

/**
 * Queries for patients' files from S3 and indicates whether they existed in the past and if they
 * exist now.
 * Stores the result in a file on `runs/s3-file-history/.../output.txt`.
 *
 * Usage:
 * - Set the environment variables in the .env file
 * - Set `cxAndPatient` array with the CX IDs, CX Names, and Patient IDs
 * - Run: `ts-node src/s3/file-history.ts`
 */

// [ [cxId, cxName, patientId], [cxId, cxName, patientId], , ... ]
const cxAndPatient: string[][] = [];
const suffix = `CONSOLIDATED_DATA.json`;

const bucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const region = getEnvVarOrFail("AWS_REGION");
const PARALLEL_CALLS_TO_S3 = 50;

const timestamp = dayjs().toISOString();
const outputFolderName = `runs/s3-file-history/${timestamp}`;
const outputFilePath = `./${outputFolderName}/output.txt`;
const sep = "\t";

makeDir(outputFolderName);

type Result = {
  cxId: string;
  cxName: string;
  patientId: string;
  previous: boolean;
  current: boolean;
};

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  console.log(`############ Starting... ############`);
  const startedAt = Date.now();

  const cxIds = groupBy(cxAndPatient, v => v[0]);
  console.log(`${Object.keys(cxIds).length} cxs, ${cxAndPatient.length} patients`);

  const patientsWithConsolidated: Result[] = [];

  for (const [cxId, entries] of Object.entries(cxIds)) {
    const cxName = entries[0][1];
    const patientIds = entries.map(v => v[2]);

    await executeAsynchronously(
      patientIds,
      async patientId => {
        const res = await getFileInfo(cxId, patientId);
        patientsWithConsolidated.push({ cxId, cxName, patientId, ...res });
      },
      { numberOfParallelExecutions: PARALLEL_CALLS_TO_S3 }
    );
    console.log(`...done cx ${cxId} - ${patientIds.length} patients`);
  }

  const outputHeader = `cxId${sep}cxName${sep}patientId${sep}previous${sep}current\n`;
  const outputContents = patientsWithConsolidated
    .map(e => `${e.cxId}${sep}${e.cxName}${sep}${e.patientId}${sep}${e.previous}${sep}${e.current}`)
    .join("\n");

  fs.appendFileSync(outputFilePath, outputHeader);
  fs.appendFileSync(outputFilePath, outputContents);

  console.log(`Done in ${elapsedTimeAsStr(startedAt)}ms - ${Object.keys(cxIds).length} CX IDs`);
}

async function getFileInfo(
  cxId: string,
  patientId: string
): Promise<{ previous: boolean; current: boolean }> {
  const s3Client = new S3Utils(region);
  const s3FilePrefix = createFilePath(cxId, patientId, suffix);

  const command = new ListObjectVersionsCommand({
    Bucket: bucketName,
    Prefix: s3FilePrefix,
  });
  const response = await s3Client._s3Client.send(command);

  const previous = !!response.Versions || !!response.DeleteMarkers;

  const command2 = new HeadObjectCommand({
    Bucket: bucketName,
    Key: s3FilePrefix,
  });
  try {
    await s3Client._s3Client.send(command2);
    return { previous, current: true };
  } catch (e) {
    return { previous, current: false };
  }
}

main();
