import { Resource } from "@medplum/fhirtypes";
import {
  createMRSummaryFileName,
  createMRSummaryBriefFileName,
} from "@metriport/core/domain/medical-record-summary";
import { Patient } from "@metriport/core/domain/patient";
import { SearchSetBundle } from "@metriport/shared/medical";
import { Config } from "../../../shared/config";
import { capture } from "../../../shared/notifications";
import { S3Utils } from "@metriport/core/external/aws/s3";

const s3Utils = new S3Utils(Config.getAWSRegion());

export async function getConsolidatedS3(patient: Patient): Promise<{
  bundle: SearchSetBundle<Resource>;
  mrBrief: string;
}> {
  //out(`getConsolidatedS3 - cxId ${patient.cxId}, patientId ${patient.id}`);
  try {
    const bucket = Config.getMedicalDocumentsBucketName();
    const fileNameBundle = createMRSummaryFileName(patient.cxId, patient.id, "json");
    const fileNameMRBrief = createMRSummaryBriefFileName(patient.cxId, patient.id);
    // Try catch -- if not exists throw 400
    const [bundleString, mrBrief] = await Promise.all([
      s3Utils.getFileContentsAsString(bucket, fileNameBundle),
      s3Utils.getFileContentsAsString(bucket, fileNameMRBrief),
    ]);
    const bundle = JSON.parse(bundleString) as SearchSetBundle<Resource>;
    return { bundle, mrBrief };
  } catch (error) {
    const msg = "Failed to get FHIR resources and MR Brief";
    capture.error(msg, {
      extra: {
        error,
        context: `getConsolidatedS3`,
        patientId: patient.id,
      },
    });
    throw error;
  }
}
