import { getS3UtilsInstance } from "@metriport/core/external/ehr/bundle/bundle-shared";
import { exec } from "child_process";

async function main(cxId: string, ptId: string) {
  const S3Utils = getS3UtilsInstance();
  const fileName = `${cxId}/${ptId}/${cxId}_${ptId}_CONSOLIDATED_DATA.json`;
  const durationSeconds = 1 * 60 * 60; //1 hour
  const bucketName = "metriport-medical-documents";

  const presignedUrl = await S3Utils.getSignedUrl({
    bucketName,
    fileName,
    durationSeconds,
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
