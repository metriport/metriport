import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { capture } from "../../../../util/notifications";
import { S3Utils } from "../../../aws/s3";
import { buildLabConversionFileNameForDate } from "../../file/file-names";
import { QuestFhirConversionResponse } from "../../types";

/**
 * Saves a bundle with Quest data to the repository.
 *
 * @param bundle - The bundle to save.
 * @param cxId - The ID of the care experience.
 * @param patientId - The ID of the patient.
 * @param dateString - The ID of the job.
 */
export async function saveBundle({
  bundle,
  cxId,
  patientId,
  dateId,
}: QuestFhirConversionResponse): Promise<void> {
  const { log } = out(`quest.saveBundle - cx ${cxId}, pat ${patientId}, date ${dateId}`);
  const bucketName = Config.getLabConversionBucketName();
  if (!bucketName) {
    const msg = "No lab conversion bucket name found";
    log(`${msg}, skipping`);
    capture.error(msg, { extra: { cxId, patientId, dateId } });
    return;
  }
  const conversionBundleName = buildLabConversionFileNameForDate({
    cxId,
    patientId,
    dateId,
  });
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const fileContent = Buffer.from(JSON.stringify(bundle));
  await s3Utils.uploadFile({ bucket: bucketName, key: conversionBundleName, file: fileContent });
  log(`Saved bundle ${conversionBundleName} to ${bucketName}`);
}
