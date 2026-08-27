import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { getS3UtilsInstance } from "@metriport/core/external/ehr/bundle/bundle-shared";
import { getEnvVarOrFail, MetriportError } from "@metriport/shared";
import { execSync } from "child_process";
import { Command } from "commander";

/**
 * @fileoverview
 * This script provides a command-line utility to generate a signed URL for a patient's consolidated
 * data bundle (JSON) stored in S3, and opens it for preview in a browser via
 * https://preview.metriport.com/. Usage requires the env vars DURATION_SECONDS and MEDICAL_BUCKET_NAME
 * to be set, and requires --cx-id and --pt-id as arguments. Designed for local usage by engineers and
 * operators for on-demand debugging, QA, and testing of consolidated patient data exports.
 */

export function openPreviewUrl(url: string): void {
  execSync(`open https://preview.metriport.com/?url=${encodeURIComponent(url)}`);
}

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
