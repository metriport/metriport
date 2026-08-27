import dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { S3Utils } from "@metriport/core/external/aws/s3";
import { createAndUploadDocumentMetadataFile } from "@metriport/core/shareback/create-and-upload-metadata";
import {
  createSharebackFolderName,
  getMetadataFilePathFromDocumentFilePath,
  METADATA_SUFFIX,
} from "@metriport/core/shareback/file";
import { shouldCreateMetadataForFile } from "@metriport/core/shareback/metadata/create-metadata-xml";
import { getEnvVar } from "@metriport/core/util/env-var";
import { computeS3ObjectSha1 } from "@metriport/core/util/hash";
import { buildDayjs } from "@metriport/shared/common/date";
import { Command } from "commander";
import { confirm } from "../../shared/confirm";
import { elapsedTimeAsStr } from "../../shared/duration";

/**
 * Script to create missing metadata files for documents in a patient's upload folder.
 * It will search for documents that don't have a corresponding metadata file and create one.
 *
 * Usage:
 * - make sure the region and bucket name are provided as env vars in the .env file or as command line arguments
 * - run it with:
 *   ts-node src/document/shareback/create-missing-metadata.ts -c <cxId> -p <patientId>
 *   ts-node src/document/shareback/create-missing-metadata.ts -r <region> -b <bucket> -c <cxId> -p <patientId>
 *   ts-node src/document/shareback/create-missing-metadata.ts -r <region> -b <bucket> -c <cxId> -p <patientId> --dry-run
 */

const defaultRegion = getEnvVar("AWS_REGION");
const defaultBucket = getEnvVar("MEDICAL_DOCUMENTS_BUCKET_NAME");

const program = new Command();
program
  .name("create-missing-metadata")
  .description("CLI to create missing metadata files for documents in a patient's upload folder")
  .requiredOption("-c, --cx-id <cxId>", "Customer ID")
  .requiredOption("-p, --patient-id <patientId>", "Patient ID")
  .option("-r, --region <region>", "AWS region", defaultRegion)
  .option("-b, --bucket <bucket>", "Medical documents bucket name", defaultBucket)
  .option("--dry-run", "Only list missing metadata files without creating them", false)
  .option("-y, --yes", "Skip confirmation prompt", false)
  .showHelpAfterError()
  .action(main);

async function main({
  cxId,
  patientId,
  region,
  bucket,
  dryRun,
  yes: skipConfirmation,
}: {
  cxId: string;
  patientId: string;
  region: string | undefined;
  bucket: string | undefined;
  dryRun: boolean;
  yes: boolean;
}) {
  if (!region) {
    console.error("Error: AWS region is required. Provide -r/--region or set AWS_REGION env var.");
    process.exit(1);
  }
  if (!bucket) {
    console.error(
      "Error: Bucket name is required. Provide -b/--bucket or set MEDICAL_DOCUMENTS_BUCKET_NAME env var."
    );
    process.exit(1);
  }
  const startedAt = Date.now();
  console.log(`>>> Starting at ${buildDayjs().toISOString()}...`);

  const s3Utils = new S3Utils(region);
  const uploadFolder = createSharebackFolderName({ cxId, patientId });

  console.log(`Searching for files in s3://${bucket}/${uploadFolder}/`);

  const allFiles = await s3Utils.listObjects(bucket, uploadFolder);
  const allFileKeys = allFiles.map(f => f.Key).filter((k): k is string => k !== undefined);

  console.log(`Found ${allFileKeys.length} total files in upload folder`);

  const metadataFiles = new Set(allFileKeys.filter(key => key.endsWith(METADATA_SUFFIX)));
  const documentFiles = allFileKeys.filter(shouldCreateMetadataForFile);

  console.log(`  - ${documentFiles.length} document files`);
  console.log(`  - ${metadataFiles.size} metadata files`);

  const documentsWithoutMetadata = documentFiles.filter(docKey => {
    const expectedMetadataKey = getMetadataFilePathFromDocumentFilePath(docKey);
    return !metadataFiles.has(expectedMetadataKey);
  });

  if (documentsWithoutMetadata.length === 0) {
    console.log(`\nAll documents have metadata files. Nothing to do.`);
    console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
    return;
  }

  console.log(`\nFound ${documentsWithoutMetadata.length} documents without metadata:`);
  const fileInfoByKey = new Map<string, Awaited<ReturnType<typeof s3Utils.getFileInfoFromS3>>>();
  for (const docKey of documentsWithoutMetadata) {
    const fileInfo = await s3Utils.getFileInfoFromS3(docKey, bucket);
    fileInfoByKey.set(docKey, fileInfo);
    const sizeKb = fileInfo.exists ? (fileInfo.sizeInBytes / 1024).toFixed(2) : "unknown";
    const contentType = fileInfo.exists ? fileInfo.contentType : "unknown";
    console.log(`  - ${docKey}`);
    console.log(`    Size: ${sizeKb} KB, Content-Type: ${contentType}`);
  }

  if (dryRun) {
    console.log(`\n[DRY RUN] Would create ${documentsWithoutMetadata.length} metadata files.`);
    console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
    return;
  }

  if (!skipConfirmation) {
    const confirmationMsg = `About to create ${documentsWithoutMetadata.length} metadata files for patient ${patientId} (cx: ${cxId})`;
    await confirm(confirmationMsg);
  }

  console.log(`\nCreating metadata files...`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const docKey of documentsWithoutMetadata) {
    const metadataKey = getMetadataFilePathFromDocumentFilePath(docKey);
    try {
      const fileInfo = fileInfoByKey.get(docKey);
      if (!fileInfo?.exists) {
        console.log(`  [SKIP] ${docKey} - file no longer exists`);
        skipped++;
        continue;
      }

      const hash = await computeS3ObjectSha1(s3Utils, bucket, docKey);

      await createAndUploadDocumentMetadataFile({
        s3Utils,
        cxId,
        patientId,
        documentS3Key: docKey,
        size: fileInfo.sizeInBytes,
        metadataS3Key: metadataKey,
        destinationBucket: bucket,
        mimeType: fileInfo.contentType,
        hash,
      });

      console.log(`  [OK] Created metadata for: ${docKey}`);
      created++;
    } catch (error) {
      console.log(`  [ERROR] Failed to create metadata for ${docKey}: ${error}`);
      failed++;
    }
  }

  console.log(`\nSummary:`);
  console.log(`  - Created: ${created}`);
  console.log(`  - Skipped: ${skipped}`);
  console.log(`  - Failed: ${failed}`);
  console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
}

program.parse();

export default program;
