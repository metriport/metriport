import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { createFilePath } from "@metriport/core/domain/filename";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { Command } from "commander";

/**
 * Remove consolidated data bundles from S3.
 *
 * Usage:
 * - Set the environment variables in the .env file
 * - Set the values of `cxId`, `patientIds`
 * - Run: `ts-node src/s3/remove-objects.ts`
 */

const cxId = "";
const patientIds: string[] = [];
const suffix = `CONSOLIDATED_DATA.json`;

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
  program.parse();
  const { dryrun: dryRun } = program.opts<Params>();

  const s3 = new S3Utils(region);

  const fileNames = patientIds.map(patientId => {
    const prefix = createFilePath(cxId, patientId, suffix);
    return prefix;
  });

  for (const fileName of fileNames) {
    const file = await s3.getFileInfoFromS3(fileName, bucketName);
    if (!file || !file.exists) {
      console.log(`File ${fileName} not found.`);
      return;
    }
    console.log(`File ${fileName} found. Size: ${file.size}`);
    if (dryRun) {
      console.log(`...Would remove the file now: ${fileName}`);
    } else {
      try {
        await s3.deleteFile({ bucket: bucketName, key: fileName });
      } catch (error) {
        console.error(`Error removing file ${fileName}: ${error}`);
        return;
      }
      console.log(`...File ${fileName} removed`);
    }
  }
}

main();
