import { createConsolidatedDataFilePath } from "../../domain/consolidated/filename";
import { S3Utils } from "../../external/aws/s3";
import { Config } from "../../util/config";
import { getConsolidatedLocation } from "./consolidated-shared";

const s3Utils = new S3Utils(Config.getAWSRegion());

/**
 * Check if consolidated data exists for a patient in S3.
 * This is a lightweight check that doesn't pull in the heavy consolidated creation dependencies.
 */
export async function doesConsolidatedDataExist(cxId: string, patientId: string): Promise<boolean> {
  const fileLocation = getConsolidatedLocation();
  const fileName = createConsolidatedDataFilePath(cxId, patientId);
  const exists = await s3Utils.fileExists(fileLocation, fileName);
  return exists;
}
