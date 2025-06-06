import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { createFilePath } from "@metriport/core/domain/filename";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getEnvVarOrFail, sleep } from "@metriport/shared";
import { groupBy } from "lodash";
import { elapsedTimeAsStr } from "../shared/duration";

/**
 * Calculates the size of the consolidated data in S3 for a list of CX IDs and Patient IDs.
 *
 * Usage:
 * - Set the environment variables in the .env file
 * - Set `cxAndPatient` array with the CX and Patient IDs
 * - Run: `ts-node src/s3/calculate-consolidated-size-in-s3.ts`
 */

/*
[
  [cxId, patientId],
  [cxId, patientId],
  ...
]
*/
const cxAndPatient: string[][] = [];
const suffix = `CONSOLIDATED_DATA.json`;

const bucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const region = getEnvVarOrFail("AWS_REGION");
const PARALLEL_CALLS_TO_S3 = 200;
const s3Utils = new S3Utils(region);

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  console.log(`############ Starting... ############`);
  const startedAt = Date.now();

  const cxIds = groupBy(cxAndPatient, v => v[0]);
  console.log(`${Object.keys(cxIds).length} cxs, ${cxAndPatient.length} patients`);

  const idsWithoutSize: { cxId: string; patientId: string }[] = [];

  let totalSize = 0;
  let totalPatients = 0;
  for (const [cxId, entries] of Object.entries(cxIds)) {
    let cxSize = 0;
    const patientIds = entries.map(v => v[1]);
    totalPatients += patientIds.length;
    await executeAsynchronously(
      patientIds,
      async patientId => {
        const res = await getFileInfo(cxId, patientId);
        if (res.sizeInBytes != undefined && !isNaN(res.sizeInBytes)) {
          totalSize += res.sizeInBytes;
          cxSize += res.sizeInBytes;
        } else {
          idsWithoutSize.push({ cxId, patientId });
        }
      },
      { numberOfParallelExecutions: PARALLEL_CALLS_TO_S3 }
    );
    console.log(`...done cx ${cxId} - ${patientIds.length} patients, ${inGigabyteStr(cxSize)}`);
  }

  console.log(`Total size: ${inGigabyteStr(totalSize)}`);
  console.log(``);
  console.log(
    `Done in ${elapsedTimeAsStr(startedAt)}ms - ${
      Object.keys(cxIds).length
    } customers, ${totalPatients} patients`
  );
  console.log(``);
  console.log(
    `Note: ${idsWithoutSize.length} patients without size/file info: ${idsWithoutSize
      .map(v => `${v.cxId} | ${v.patientId}`)
      .join("\n")}`
  );
}

async function getFileInfo(
  cxId: string,
  patientId: string
): Promise<{ sizeInBytes: number | undefined }> {
  const s3FilePrefix = createFilePath(cxId, patientId, suffix);
  try {
    const resp = await s3Utils.getFileInfoFromS3(s3FilePrefix, bucketName);
    return { sizeInBytes: resp.size };
  } catch (e) {
    return { sizeInBytes: undefined };
  }
}

function inGigabyteStr(bytes: number): string {
  return (bytes / 1_048_576_000).toFixed(2) + " GB";
}

main();
