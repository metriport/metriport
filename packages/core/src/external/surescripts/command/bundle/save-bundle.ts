import { Bundle } from "@medplum/fhirtypes";
import { executeWithNetworkRetries } from "@metriport/shared";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { capture } from "../../../../util/notifications";
import { S3Utils } from "../../../aws/s3";
import {
  buildConversionBundleFileNameForJob,
  buildLatestConversionBundleFileName,
} from "../../file/file-names";

/**
 * Saves the bundle with Surescripts data to the repository.
 *
 * @param bundle - The bundle to save.
 * @param cxId - The ID of the care experience.
 * @param patientId - The ID of the patient.
 * @param jobId - The ID of the job.
 */
export async function saveBundle({
  bundle,
  cxId,
  patientId,
  jobId,
}: {
  bundle: Bundle;
  cxId: string;
  patientId: string;
  jobId: string;
}): Promise<void> {
  const { log } = out(`ss.saveBundle - cx ${cxId}, pat ${patientId}, job ${jobId}`);
  const bucketName = Config.getPharmacyConversionBucketName();
  if (!bucketName) {
    const msg = "No pharmacy conversion bucket name found";
    log(`${msg}, skipping`);
    capture.error(msg, { extra: { cxId, patientId, jobId } });
    return;
  }
  const latestBundleName = buildLatestConversionBundleFileName(cxId, patientId);
  const conversionBundleName = buildConversionBundleFileNameForJob({
    cxId,
    patientId,
    jobId,
  });
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const fileContent = Buffer.from(JSON.stringify(bundle));
  await Promise.all([
    executeWithNetworkRetries(() =>
      s3Utils.uploadFile({ bucket: bucketName, key: latestBundleName, file: fileContent })
    ),
    executeWithNetworkRetries(() =>
      s3Utils.uploadFile({ bucket: bucketName, key: conversionBundleName, file: fileContent })
    ),
  ]);
  log(`Saved bundle ${latestBundleName} and ${conversionBundleName} to ${bucketName}`);
}
