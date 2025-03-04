import {
  normalizeDob,
  normalizeEmailStrict,
  normalizeExternalId,
  normalizeGender,
  normalizePhoneNumberStrict,
  normalizeUSStateForAddress,
  normalizeZipCodeNew,
  PatientImportPatient,
  toTitleCase,
} from "@metriport/shared";
import { S3Utils } from "../../external/aws/s3";
import { Config } from "../../util/config";
import { PatientPayload } from "./patient-import";

const globalPrefix = "patient-import";
const region = Config.getAWSRegion();

const folderFiles = "files";
const folderPatients = "patients";
const folderMappings = "mappings";

export type FileStages = "raw" | "headers" | "result";

function createCxJobPrefix(cxId: string, jobId: string): string {
  return `cxid=${cxId}/jobid=${jobId}`;
}

export function createFileKeyJob(cxId: string, jobId: string): string {
  const prefix = createCxJobPrefix(cxId, jobId);
  const fileName = `job.json`;
  const key = `${globalPrefix}/${prefix}/${fileName}`;
  return key;
}

export function createFilePathPatientRecords(cxId: string, jobId: string): string {
  const prefix = createCxJobPrefix(cxId, jobId);
  const fileName = `records`;
  const key = `${globalPrefix}/${prefix}/${folderPatients}/${fileName}`;
  return key;
}
export function createFileKeyPatientRecord(cxId: string, jobId: string, rowNumber: number): string {
  const prefix = createFilePathPatientRecords(cxId, jobId);
  const fileName = `${rowNumber}.json`;
  const key = `${prefix}/${fileName}`;
  return key;
}

export function createFileKeyPatientMapping(
  cxId: string,
  jobId: string,
  patientId: string
): string {
  const prefix = createCxJobPrefix(cxId, jobId);
  const fileName = `${patientId}.json`;
  const key = `${globalPrefix}/${prefix}/${folderPatients}/${folderMappings}/${fileName}`;
  return key;
}

export function createFileKeyStage(cxId: string, jobId: string, stage: FileStages): string {
  const prefix = createCxJobPrefix(cxId, jobId);
  const fileName = `${stage}.csv`;
  const key = `${globalPrefix}/${prefix}/${folderFiles}/${fileName}`;
  return key;
}

export function createFileKeyRaw(cxId: string, jobId: string): string {
  return createFileKeyStage(cxId, jobId, "raw");
}
export function createFileKeyHeaders(cxId: string, jobId: string): string {
  return createFileKeyStage(cxId, jobId, "headers");
}
export function createFileKeyResults(cxId: string, jobId: string): string {
  return createFileKeyStage(cxId, jobId, "result");
}

export function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

export type GenericObject = { [key: string]: string | undefined };

export function createPatientPayload(patient: PatientImportPatient): PatientPayload {
  const phone1 = patient.phone1 ? normalizePhoneNumberStrict(patient.phone1) : undefined;
  const email1 = patient.email1 ? normalizeEmailStrict(patient.email1) : undefined;
  const phone2 = patient.phone2 ? normalizePhoneNumberStrict(patient.phone2) : undefined;
  const email2 = patient.email2 ? normalizeEmailStrict(patient.email2) : undefined;
  const contact1 = phone1 || email1 ? { phone: phone1, email: email1 } : undefined;
  const contact2 = phone2 || email2 ? { phone: phone2, email: email2 } : undefined;
  const contact = [contact1, contact2].flatMap(c => c ?? []);
  const externalId = patient.externalid ? normalizeExternalId(patient.externalid) : undefined;
  return {
    externalId,
    firstName: toTitleCase(patient.firstname),
    lastName: toTitleCase(patient.lastname),
    dob: normalizeDob(patient.dob),
    genderAtBirth: normalizeGender(patient.gender),
    address: [
      {
        addressLine1: toTitleCase(patient.addressline1),
        ...(patient.addressline2 ? { addressLine2: toTitleCase(patient.addressline2) } : undefined),
        city: toTitleCase(patient.city),
        state: normalizeUSStateForAddress(patient.state),
        zip: normalizeZipCodeNew(patient.zip),
        country: "USA",
      },
    ],
    contact,
  };
}
