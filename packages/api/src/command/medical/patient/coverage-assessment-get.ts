import { createMRSummaryFileName } from "@metriport/core/domain/medical-record-summary";
import { Patient } from "@metriport/core/domain/patient";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { countResources } from "../../../external/fhir/patient/count-resources";
import { InternalPatientDTO, internalDtoFromModel } from "../../../routes/medical/dtos/patientDTO";
import { Config } from "../../../shared/config";

const region = Config.getAWSRegion();
const bucket = Config.getMedicalDocumentsBucketName();

dayjs.extend(duration);

const signedUrlDuration = dayjs.duration(1, "hour");

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

type CoverageAssessment = {
  downloadStatus: string | undefined;
  docCount: number | undefined;
  convertStatus: string | undefined;
  fhirCount: number;
  fhirDetails: string;
  mrSummaryUrl: string | undefined;
};

export type PatientWithCoverageAssessment = InternalPatientDTO & Partial<CoverageAssessment>;

export async function getCoverageAssessments({
  cxId,
  patients,
}: {
  cxId: string;
  patients: Patient[];
}): Promise<PatientWithCoverageAssessment[]> {
  const { log } = out(`getCoverageAssessments - cxId ${cxId}`);
  const patientsWithAssessment: PatientWithCoverageAssessment[] = [];
  const wrapperErrors: string[] = [];

  async function getCoverageAssessmentWrapper({
    cxId,
    patient,
    patientsWithAssessment,
    errors,
    log,
  }: {
    cxId: string;
    patient: Patient;
    patientsWithAssessment: PatientWithCoverageAssessment[];
    errors: string[];
    log: typeof console.log;
  }): Promise<void> {
    try {
      const coverageAssessment = await getCoverageAssessment({ cxId, patient, log });
      patientsWithAssessment.push({
        ...internalDtoFromModel(patient),
        ...coverageAssessment,
      });
    } catch (error) {
      const msg = `Patient: ${patient.id}. Cause: ${errorToString(error)}`;
      log(msg);
      errors.push(msg);
      patientsWithAssessment.push(internalDtoFromModel(patient));
    }
  }

  await executeAsynchronously(
    patients.map(patient => {
      return { cxId, patient, patientsWithAssessment, errors: wrapperErrors, log };
    }),
    getCoverageAssessmentWrapper,
    { numberOfParallelExecutions: 20 }
  );

  if (wrapperErrors.length > 0) {
    capture.error("Failed to get coverage assessments.", {
      extra: {
        cxId,
        patientCount: patients.length,
        errorCount: wrapperErrors.length,
        errors: wrapperErrors.join(","),
        context: "coverage-assessment.get",
      },
    });
  }

  return patientsWithAssessment;
}

async function getCoverageAssessment({
  cxId,
  patient,
  log,
}: {
  cxId: string;
  patient: Patient;
  log: typeof console.log;
}): Promise<CoverageAssessment> {
  const mrSummaryFileName = createMRSummaryFileName(cxId, patient.id, "pdf");
  const [fhirResources, mrSummaryUrl] = await Promise.all([
    countResources({ patient }),
    getMrSummaryUrl(mrSummaryFileName, log),
  ]);

  const download = patient.data.documentQueryProgress?.download;
  const convert = patient.data.documentQueryProgress?.convert;
  const downloadStatus = download?.status;
  const docCount = download?.successful;
  const convertStatus = convert?.status;
  const fhirCount = fhirResources.total;
  const fhirDetails = JSON.stringify(fhirResources.resources).replaceAll(",", " ");

  return {
    downloadStatus,
    docCount,
    convertStatus,
    fhirCount,
    fhirDetails,
    mrSummaryUrl,
  };
}

async function getMrSummaryUrl(
  fileName: string,
  log: typeof console.log
): Promise<string | undefined> {
  const s3Utils = getS3UtilsInstance();
  try {
    const object = await s3Utils.getFileInfoFromS3(fileName, bucket);
    if (object.exists) {
      return await s3Utils.getSignedUrl({
        bucketName: bucket,
        fileName,
        durationSeconds: signedUrlDuration.asSeconds(),
      });
    }
    return undefined;
  } catch (error) {
    const msg = `Failed to get get MR Summary url for coverage assessment. Cause: ${errorToString(
      error
    )}`;
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
