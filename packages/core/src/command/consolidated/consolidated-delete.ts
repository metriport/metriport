import { createConsolidatedDataFilePath } from "../../domain/consolidated/filename";
import { S3Utils } from "../../external/aws/s3";
import { out } from "../../util";
import { Config } from "../../util/config";

const destinationBucketName = Config.getMedicalDocumentsBucketName();
const s3Utils = new S3Utils(Config.getAWSRegion());

export type DeleteConsolidatedCommand = {
  cxId: string;
  patientId: string;
};

/**
 * Deletes a Patient's consolidated bundle from the storage.
 */
export async function deleteConsolidated({
  cxId,
  patientId,
}: DeleteConsolidatedCommand): Promise<void> {
  const { log } = out(`deleteConsolidated - cx ${cxId}, pat ${patientId}`);

  const destinationFileName = createConsolidatedDataFilePath(cxId, patientId);
  log(`Deleting consolidated bundle from ${destinationBucketName}, key ${destinationFileName}`);

  await s3Utils.deleteFile({
    bucket: destinationBucketName,
    key: destinationFileName,
  });
  log(`Done`);
}
