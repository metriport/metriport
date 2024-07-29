import { Patient } from "@metriport/core/domain/patient";
import { createMRSummaryFileName } from "@metriport/core/domain/medical-record-summary";
import { getSignedUrl } from "@metriport/core/external/aws/s3";
import { countResources } from "../../../external/fhir/patient/count-resources";
import { Config } from "../../../shared/config";
import { CoverageAssessment } from "./converage-assessment-create";

const region = Config.getAWSRegion();
const bucket = Config.getMedicalDocumentsBucketName();

export async function getCoverageAssessment({
  cxId,
  patient,
}: {
  cxId: string;
  patient: Patient;
}): Promise<CoverageAssessment> {
  const getMrSummaryUrl = async (fileName: string): Promise<string | undefined> => {
    try {
      return await getSignedUrl({
        bucketName: bucket,
        fileName,
        awsRegion: region,
      });
    } catch (error) {
      return undefined;
    }
  };

  const mrSummaryFileName = createMRSummaryFileName(cxId, patient.id, "json");
  const [fhirResources, mrSummaryUrl] = await Promise.all([
    countResources({ patient }),
    getMrSummaryUrl(mrSummaryFileName),
  ]);

  const download = patient.data.documentQueryProgress?.download;
  const convert = patient.data.documentQueryProgress?.convert;
  const downloadStatus = download?.status;
  const docCount = download?.successful;
  const convertStatus = convert?.status;
  const fhirCount = fhirResources.total;
  const fhirDetails = JSON.stringify(fhirResources.resources).replaceAll(",", " ");

  return {
    patientId: patient.id,
    downloadStatus,
    docCount,
    convertStatus,
    fhirCount,
    fhirDetails,
    mrSummaryUrl,
  };
}
