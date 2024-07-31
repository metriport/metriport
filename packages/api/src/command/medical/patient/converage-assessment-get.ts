import { Patient } from "@metriport/core/domain/patient";
import { createMRSummaryFileName } from "@metriport/core/domain/medical-record-summary";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { countResources } from "../../../external/fhir/patient/count-resources";
import { Config } from "../../../shared/config";
import { log } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared";

const region = Config.getAWSRegion();
const bucket = Config.getMedicalDocumentsBucketName();

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

type CoverageAssessment = {
  patientId: string;
  downloadStatus: string | undefined;
  docCount: number | undefined;
  convertStatus: string | undefined;
  fhirCount: number;
  fhirDetails: string;
  mrSummaryUrl: string | undefined;
};

export async function getCoverageAssessment({
  cxId,
  patient,
}: {
  cxId: string;
  patient: Patient;
}): Promise<CoverageAssessment> {
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

async function getMrSummaryUrl(fileName: string): Promise<string | undefined> {
  const s3Utils = getS3UtilsInstance();
  try {
    const object = await s3Utils.getFileInfoFromS3(fileName, bucket);
    if (object.exists) {
      return await s3Utils.getSignedUrl({
        bucketName: bucket,
        fileName,
      });
    }
    return undefined;
  } catch (error) {
    const msg = "Failed to get get MR Summary url";
    log(`${msg}. Cause: ${errorToString(error)}.`);
    capture.error(msg, {
      extra: {
        fileName,
        context: "coverage-assessment.get",
      },
    });
    return undefined;
  }
}
