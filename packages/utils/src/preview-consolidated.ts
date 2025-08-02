import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { getS3UtilsInstance } from "@metriport/core/external/ehr/bundle/bundle-shared";
import { exec } from "child_process";
import { getEnvVarOrFail, MetriportError } from "@metriport/shared";

async function main(cxId: string, ptId: string) {
  const S3Utils = getS3UtilsInstance();
  const fileName = `${cxId}/${ptId}/${cxId}_${ptId}_CONSOLIDATED_DATA.json`;
  const durationSeconds = getEnvVarOrFail("DURATION_SECONDS");
  const bucketName = getEnvVarOrFail("MEDICAL_BUCKET_NAME");

  const existsFile = await S3Utils.fileExists(bucketName, fileName);

  if (!existsFile) {
    throw new MetriportError(
      `Could not find file. Make sure your cxId and ptId are correct.`,
      undefined,
      { cxId, ptId }
    );
  }

  const presignedUrl = await S3Utils.getSignedUrl({
    bucketName,
    fileName,
    durationSeconds: Number(durationSeconds),
  });

  const encoded = encodeURIComponent(presignedUrl);

  const url = `https://preview.metriport.com?url=${encoded}`;

  exec(`open -a "Google Chrome" "${url}"`);
}

const args = process.argv.slice(2);
const [cxId, ptId] = args;

main(cxId, ptId).catch(error => {
  console.error("Error: ", error);
  process.exit(1);
});
