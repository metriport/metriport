import {
  PatientImportPatient,
  normalizeDate,
  normalizeGender,
  normalizeState,
  normalizeZipCode,
  normalizePhoneNumberStrict,
  normalizeEmailStrict,
  normalizeExternalId,
  toTitleCase,
} from "@metriport/shared";
import { PatientPayload } from "./patient-import";

const globalPrefix = "patient-import";

export function createCxJobPrefix(cxId: string, jobId: string): string {
  return `cxid=${cxId}/jobid=${jobId}`;
}

export function createFileKeyJob(cxId: string, jobId: string): string {
  return `${createCxJobPrefix(cxId, jobId)}/status.json}`;
}

export function createFilePathPatients(cxId: string, jobId: string, patientId: string): string {
  return `${createCxJobPrefix(cxId, jobId)}/patients/patientid=${patientId}/status.json`;
}

export function createFileKeyPatient(cxId: string, jobId: string, patientId: string): string {
  const fileName = createFilePathPatients(cxId, jobId, patientId);
  const key = `${globalPrefix}/${fileName}`;
  return key;
}

export type FileStages = "raw" | "valid" | "invalid";

export function createFilePathFiles(cxId: string, jobId: string, stage: FileStages): string {
  return `${createCxJobPrefix(cxId, jobId)}/files/${stage}.csv`;
}

export function createFileKeyFiles(cxId: string, jobId: string, stage: FileStages): string {
  const fileName = createFilePathFiles(cxId, jobId, stage);
  const key = `${globalPrefix}/${fileName}`;
  return key;
}

export const PatientImportCsvHeaders = [
  "externalid",
  "firstname",
  "lastname",
  "dob",
  "gender",
  "zip",
  "city",
  "state",
  "addressline1",
  "addressline2",
  "phone1",
  "email1",
  "phone2",
  "email2",
];

const replaceCharacters = ["*"];

export function normalizeHeaders(headers: string[]): string[] {
  let newHeaders = headers;
  replaceCharacters.map(char => {
    newHeaders = newHeaders.map(h => h.replace(char, "").toLowerCase());
  });
  return newHeaders;
}

export function compareCsvHeaders(headers: string[], input: string[], exact = false): boolean {
  let newInput = input;
  if (!exact) {
    newInput = newInput.slice(0, headers.length);
  }
  return headers.toString() === newInput.toString();
}

export type GenericObject = { [key: string]: string | undefined };

export function createObjectsFromCsv({
  fileName,
  rows,
  headers,
}: {
  fileName: string;
  rows: string[];
  headers: string[];
}): GenericObject[] {
  return rows.slice(1).map((row: string) => {
    const object: GenericObject = {};
    const rowValues = row.split(",");
    headers.forEach((header, i) => {
      const value = rowValues[i];
      if (!value) throw new Error(`Row ${i} invalid in fle ${fileName} with headers ${headers}`);
      object[header] = value.trim() === "" ? undefined : value;
    });
    return object;
  });
}

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
    dob: normalizeDate(patient.dob),
    genderAtBirth: normalizeGender(patient.gender),
    address: [
      {
        addressLine1: toTitleCase(patient.addressline1),
        ...(patient.addressline2 ? { addressLine2: toTitleCase(patient.addressline2) } : undefined),
        city: toTitleCase(patient.city),
        state: normalizeState(patient.state),
        zip: normalizeZipCode(patient.zip),
        country: "USA",
      },
    ],
    contact,
  };
}
