import { Bundle } from "@medplum/fhirtypes";
import { SurescriptsRosterType } from "@metriport/shared/interface/external/surescripts/roster";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { capture } from "../../../../util/notifications";
import { S3Utils } from "../../../aws/s3";
import { buildPatientPharmacyConversionFileName } from "../../file/file-names";

/**
 * Saves the bundle with Surescripts data to the repository.
 *
 * @param bundle - The bundle to save.
 * @param cxId - The ID of the care experience.
 * @param patientId - The ID of the patient.
 * @param rosterId - The ID of the roster.
 */
export async function savePharmacyConversionBundle({
  bundle,
  cxId,
  patientId,
  rosterId,
  rosterType,
}: {
  bundle: Bundle;
  cxId: string;
  patientId: string;
  rosterId: string;
  rosterType: SurescriptsRosterType;
}): Promise<void> {
  const { log } = out(
    `ss.savePharmacyConversionBundle - cx ${cxId}, pat ${patientId}, roster ${rosterId}`
  );
  const bucketName = Config.getPharmacyConversionBucketName();
  if (!bucketName) {
    const msg = "No pharmacy conversion bucket name found";
    log(`${msg}, skipping`);
    capture.error(msg, { extra: { cxId, patientId, rosterId } });
    return;
  }
  const conversionBundleName = buildPatientPharmacyConversionFileName({
    cxId,
    patientId,
    rosterId,
    rosterType,
  });
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const fileContent = Buffer.from(JSON.stringify(bundle));
  await s3Utils.uploadFile({ bucket: bucketName, key: conversionBundleName, file: fileContent });
  log(`Saved bundle ${conversionBundleName} to ${bucketName}`);
}
