import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { getS3UtilsInstance } from "@metriport/core/external/ehr/bundle/bundle-shared";
import { getEnvVarOrFail, MetriportError } from "../../shared/dist";
import { Command } from "commander";

async function main(cxId: string, ptId: string) {
  const S3Utils = getS3UtilsInstance();
  const trimmedCxId = cxId.trim();
  const trimmedPtId = ptId.trim();
  const fileName = `${trimmedCxId}/${trimmedPtId}/${trimmedCxId}_${trimmedPtId}_CONSOLIDATED_DATA.json`;
  const durationSeconds = getEnvVarOrFail("DURATION_SECONDS");
  const bucketName = getEnvVarOrFail("MEDICAL_BUCKET_NAME");

  const fileExists = await S3Utils.fileExists(bucketName, fileName);

  if (!fileExists) {
    throw new MetriportError(
      `File does not exist. Make sure your cxId and ptId are correct.`,
      undefined,
      { cxId, ptId, bucketName, durationSeconds }
    );
  }

  const presignedUrl = await S3Utils.getSignedUrl({
    bucketName,
    fileName,
    durationSeconds: Number(durationSeconds),
  });

  const encoded = encodeURIComponent(presignedUrl);

  const url = `https://preview.metriport.com?url=${encoded}`;

  console.log(`Open this url: ${url}`);
}

const program = new Command();

program
  .name("preview-consolidated")
  .option("--cx-id <cxId>", "The customer ID")
  .option("--pt-id <ptId>", "The patient ID")
  .description("Previews a patients consolidated bundle")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async function ({ cxId, ptId }) {
    await main(cxId, ptId);
  });

program.parse(process.argv);

export default program;
