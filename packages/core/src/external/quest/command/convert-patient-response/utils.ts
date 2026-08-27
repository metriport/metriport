import { Bundle } from "@medplum/fhirtypes";
import { executeWithNetworkRetries } from "@metriport/shared";
import { QuestRosterType } from "@metriport/shared/interface/external/quest/roster";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { capture } from "../../../../util/notifications";
import { S3Utils } from "../../../aws/s3";
import { buildPatientLabConversionFileName } from "../../file/file-names";

/**
 * Saves a bundle with Quest data to the repository.
 *
 * @param bundle - The bundle to save.
 * @param cxId - The ID of the care experience.
 * @param patientId - The ID of the patient.
 * @param dateId - The ID of the date.
 * @param rosterType - The type of roster.
 */
export async function saveLabConversionBundle({
  bundle,
  cxId,
  patientId,
  dateId,
  rosterType,
}: {
  bundle: Bundle;
  cxId: string;
  patientId: string;
  dateId: string;
  rosterType: QuestRosterType;
}): Promise<void> {
  const { log } = out(
    `Quest conversion bundle saver - cx ${cxId}, pat ${patientId}, date ${dateId}`
  );
  const bucketName = Config.getLabConversionBucketName();
  if (!bucketName) {
    const msg = "No lab conversion bucket name found";
    log(`${msg}, skipping`);
    capture.error(msg, { extra: { cxId, patientId, dateId } });
    return;
  }
  const conversionBundleName = buildPatientLabConversionFileName({
    cxId,
    patientId,
    dateId,
    rosterType,
  });
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const fileContent = Buffer.from(JSON.stringify(bundle));
  await executeWithNetworkRetries(() =>
    s3Utils.uploadFile({ bucket: bucketName, key: conversionBundleName, file: fileContent })
  );
  log(`Saved bundle ${conversionBundleName} to ${bucketName}`);
}
