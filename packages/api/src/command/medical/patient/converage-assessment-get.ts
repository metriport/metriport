import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { PatientModel } from "../../../models/medical/patient";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { createMRSummaryFileName } from "@metriport/core/domain/medical-record-summary";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { InternalPatientDTO, internalDtoFromModel } from "../../../routes/medical/dtos/patientDTO";
import { countResources } from "../../../external/fhir/patient/count-resources";
import { Config } from "../../../shared/config";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared";

const region = Config.getAWSRegion();
const medicalBucket = Config.getMedicalDocumentsBucketName();
const generalBucket = Config.getGeneralBucketName();

dayjs.extend(duration);

const signedUrlDuration = dayjs.duration(1, "day");

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
  facilityId,
  patients,
  createCsv = false,
}: {
  cxId: string;
  facilityId: string;
  patients: PatientModel[];
  createCsv?: boolean;
}): Promise<PatientWithCoverageAssessment[] | void> {
  const { log } = out(`getCoverageAssessments - cxId ${cxId}`);
  if (!generalBucket) throw new Error("General bucket must be defined");

  const s3Utils = getS3UtilsInstance();
  const filePath = `cxId=${cxId}/facilityId=${facilityId}`;
  const fileName = `coverage-assessment/${filePath}/assessment.csv`;

  if (createCsv) {
    const patientsWithAssessment: PatientWithCoverageAssessment[] = [];
    const getErrors: string[] = [];
    await executeAsynchronously(
      patients.map(patient => {
        return { cxId, patient, patientsWithAssessment, errors: getErrors, log };
      }),
      getCoverageAssessment,
      { numberOfParallelExecutions: 20 }
    );

    if (getErrors.length > 0) {
      capture.error("Failed to get coverage assessments.", {
        extra: {
          cxId,
          patientCount: patients.length,
          errorCount: getErrors.length,
          errors: getErrors.join(","),
          context: "coverage-assessment.get",
        },
      });
    }

    await s3Utils.uploadFile({
      bucket: generalBucket,
      key: fileName,
      file: Buffer.from(JSON.stringify(patientsWithAssessment), "utf8"),
      contentType: "application/json",
    });
  } else {
    const object = await s3Utils.getFileInfoFromS3(fileName, generalBucket);
    if (!object.exists)
      throw new Error("You must run getCoverageAssessments with createCsv = true at least once.");
    const data = await s3Utils.getFileContentsAsString(generalBucket, fileName);
    return JSON.parse(data) as PatientWithCoverageAssessment[];
  }
}

async function singleGetCoverageAssessment({
  cxId,
  patient,
  log,
}: {
  cxId: string;
  patient: PatientModel;
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

async function getCoverageAssessment({
  cxId,
  patient,
  patientsWithAssessment,
  errors,
  log,
}: {
  cxId: string;
  patient: PatientModel;
  patientsWithAssessment: PatientWithCoverageAssessment[];
  errors: string[];
  log: typeof console.log;
}): Promise<void> {
  try {
    const coverageAssessment = await singleGetCoverageAssessment({ cxId, patient, log });
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

async function getMrSummaryUrl(
  fileName: string,
  log: typeof console.log
): Promise<string | undefined> {
  const s3Utils = getS3UtilsInstance();
  try {
    const object = await s3Utils.getFileInfoFromS3(fileName, medicalBucket);
    if (object.exists) {
      return await s3Utils.getSignedUrl({
        bucketName: medicalBucket,
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
