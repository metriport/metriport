import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { getS3UtilsInstance } from "@metriport/core/external/ehr/bundle/bundle-shared";
import { getEnvVarOrFail, MetriportError } from "../../shared/dist";
import { Command } from "commander";
import { openPreviewUrl } from "./surescripts/shared";

type PreviewParams = {
  cxId: string;
  ptId: string;
};

async function main({ cxId, ptId }: PreviewParams) {
  const S3Utils = getS3UtilsInstance();
  const trimmedCxId = cxId.trim();
  const trimmedPtId = ptId.trim();
  const fileName = `${trimmedCxId}/${trimmedPtId}/${trimmedCxId}_${trimmedPtId}_CONSOLIDATED_DATA.json`;
  const durationSecondsString = getEnvVarOrFail("DURATION_SECONDS");
  const bucketName = getEnvVarOrFail("MEDICAL_BUCKET_NAME");
  const durationSeconds = Number(durationSecondsString);

  if (isNaN(durationSeconds)) {
    throw new MetriportError(`Your DURATION_SECONDS is NaN.`, undefined, { durationSeconds });
  }

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
    durationSeconds,
  });

  openPreviewUrl(presignedUrl);
}

const program = new Command();

program
  .name("preview-consolidated")
  .requiredOption("--cx-id <cxId>", "The customer ID")
  .requiredOption("--pt-id <ptId>", "The patient ID")
  .description("Previews a patients consolidated bundle")
  .showHelpAfterError()
  .version("1.0.0")
  .action(main);

program.parse(process.argv);

export default program;
