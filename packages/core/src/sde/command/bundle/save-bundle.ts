import { Bundle } from "@medplum/fhirtypes";
import { executeWithNetworkRetries } from "@metriport/shared";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { S3Utils } from "../../../external/aws/s3";
import { getDataExtractionFileName } from "../../file-names";

/**
 * Saves the bundle with structured data to the repository.
 *
 * @param bundle - The bundle to save.
 * @param cxId - The ID of the care experience.
 * @param patientId - The ID of the patient.
 * @param documentId - The ID of the document.
 */
export async function saveBundle({
  bundle,
  cxId,
  patientId,
  documentId,
}: {
  bundle: Bundle;
  cxId: string;
  patientId: string;
  documentId: string;
}): Promise<void> {
  const { log } = out(`sde.saveBundle - cx ${cxId}, pat ${patientId}, doc ${documentId}`);
  const bucketName = Config.getStructuredDataBucketName();
  if (!bucketName) {
    const msg = "No structured data bucket name found";
    log(`${msg}, skipping`);
    capture.error(msg, { extra: { cxId, patientId, documentId } });
    return;
  }
  const latestBundleName = getDataExtractionFileName({ cxId, patientId, documentId });
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const fileContent = Buffer.from(JSON.stringify(bundle));
  await executeWithNetworkRetries(() =>
    s3Utils.uploadFile({ bucket: bucketName, key: latestBundleName, file: fileContent })
  );
  log(`Saved bundle ${latestBundleName} to ${bucketName}`);
}
