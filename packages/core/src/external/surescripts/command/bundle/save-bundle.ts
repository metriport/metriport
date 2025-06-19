import { Bundle } from "@medplum/fhirtypes";
import { executeWithNetworkRetries } from "@metriport/shared";
import { Config } from "../../../../util/config";
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
  const latestBundleName = buildLatestConversionBundleFileName(cxId, patientId);
  const conversionBundleName = buildConversionBundleFileNameForJob({
    cxId,
    patientId,
    jobId,
  });
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const fileContent = Buffer.from(JSON.stringify(bundle));
  await executeWithNetworkRetries(async () => {
    await Promise.all([
      s3Utils.uploadFile({
        bucket: Config.getPharmacyConversionBucketName(),
        key: latestBundleName,
        file: fileContent,
      }),
      s3Utils.uploadFile({
        bucket: Config.getPharmacyConversionBucketName(),
        key: conversionBundleName,
        file: fileContent,
      }),
    ]);
  });
}
