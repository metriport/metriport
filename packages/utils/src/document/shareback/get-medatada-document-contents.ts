import dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { ListObjectsCommand } from "@aws-sdk/client-s3";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { createSharebackFolderName } from "@metriport/core/shareback/file";
import { getMetadataDocumentContents } from "@metriport/core/shareback/metadata/get-metadata-xml";
import { Config } from "@metriport/core/util/config";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { sleep } from "@metriport/shared";
import { elapsedTimeAsStr } from "../../shared/duration";

/**
 * This script gets the metadata document contents used for shareback/data contribution of a given
 * patient. It also lists all the files in the shareback folder just like the code from core does,
 * and displays the file info for the metadata file.
 *
 * Usage:
 * - Set these environment variables:
 *   - CX_ID
 *   - PATIENT_ID
 *   - AWS_REGION
 *   - MEDICAL_DOCUMENTS_BUCKET_NAME
 * - Run the script:
 *   - ts-node src/document/shareback/get-medatada-document-contents.ts
 */

const cxId = getEnvVarOrFail("CX_ID");
const patientId = getEnvVarOrFail("PATIENT_ID");
const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  console.log(`############## Started at ${new Date(startedAt).toISOString()} ##############`);

  const prefix = createSharebackFolderName({ cxId, patientId });
  const s3Key = `${prefix}/${cxId}_${patientId}_ccd_metadata.xml`;
  const bucketName = Config.getMedicalDocumentsBucketName();
  console.log("s3Key: ", s3Key);
  console.log("bucketName: ", bucketName);
  const cmd = new ListObjectsCommand({ Bucket: bucketName, Prefix: prefix });
  const data = await s3Utils._s3Client.send(cmd);
  console.log(`Found ${data.Contents?.length} files:`);
  data.Contents?.forEach(item => {
    console.log(`- ${item.Key}`);
  });

  const metadataDocumentContents = await getMetadataDocumentContents(cxId, patientId);
  console.log("metadataDocumentContents: ", metadataDocumentContents);

  const fileInfo = await s3Utils.getFileInfoFromS3(s3Key, bucketName);
  console.log("fileInfo: ", fileInfo);

  console.log(`Done in ${elapsedTimeAsStr(startedAt)}`);
}

main();
