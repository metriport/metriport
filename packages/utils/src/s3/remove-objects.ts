import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { createFilePath } from "@metriport/core/domain/filename";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { sleep } from "@metriport/shared";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { Command } from "commander";
import { groupBy } from "lodash";

/**
 * Remove objects from S3.
 *
 * Usage:
 * - Set the environment variables in the .env file
 * - Set `cxAndPatient` array with the CX IDs and Patient IDs
 * - Run: `ts-node src/s3/remove-objects.ts`
 */

// [ [cxId, patientId], [cxId, patientId], ... ]
const cxAndPatient: string[][] = [];

// List of file suffixes to get the files to be removed for each patient
const suffixes = [`CONSOLIDATED_DATA.json`];

const bucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const region = getEnvVarOrFail("AWS_REGION");

type Params = {
  dryrun?: boolean;
};
const program = new Command();
program
  .name("remove-objects")
  .description("CLI to remove files/objects from S3.")
  .option(
    `--dryrun`,
    "Just validate the inputs and logic without performing any operation/updates."
  )
  .showHelpAfterError();

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  program.parse();
  const { dryrun: dryRun } = program.opts<Params>();
  const prefix = dryRun ? "[DRY-RUN] " : "";
  const s3 = new S3Utils(region);
  let countRemovedTotal = 0;
  const cxsAndPatients = groupBy(cxAndPatient, v => v[0]);
  const cxIds = Object.keys(cxsAndPatients);
  console.log(`${prefix}${cxIds.length} CX IDs found.`);

  for (const [cxId, entries] of Object.entries(cxsAndPatients)) {
    const { log } = out(`${prefix}cx ${cxId}`);
    const patientIds = entries.map(v => v[1]);
    log(`Processing ${patientIds.length} patients...`);

    const fileNames = patientIds.flatMap(patientId => {
      return suffixes.map(suffix => createFilePath(cxId, patientId, suffix));
    });

    let countRemovedPerCx = 0;
    await executeAsynchronously(
      fileNames,
      async fileName => {
        const file = await s3.getFileInfoFromS3(fileName, bucketName);
        if (!file || !file.exists) return;
        if (dryRun) {
          log(`...Would remove the file now: ${fileName}`);
          countRemovedPerCx++;
          return;
        }
        try {
          await s3.deleteFile({ bucket: bucketName, key: fileName });
        } catch (error) {
          log(`Error removing file ${fileName}: ${error}`);
          return;
        }
        countRemovedPerCx++;
      },
      { numberOfParallelExecutions: 10 }
    );
    log(`Total files removed: ${countRemovedPerCx}`);
    countRemovedTotal += countRemovedPerCx;
  }
  console.log(
    `${prefix}${cxIds.length} CX IDs found, ${countRemovedTotal} files removed in total.`
  );
}

main();
