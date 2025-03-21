import {
  PatientImportEntryStatusFailed,
  PatientImportEntryStatusParsed,
  PatientImportParamsCx,
  PatientImportParamsOps,
} from "@metriport/shared/domain/patient/patient-import/types";
import { PatientDemoData } from "../../domain/patient";

export type JobRecord = {
  cxId: string;
  facilityId: string;
  jobId: string;
  createdAt: string;
  paramsCx: PatientImportParamsCx;
  paramsOps: PatientImportParamsOps;
};

export type FailedPatientRecord = {
  status: PatientImportEntryStatusFailed;
  patientCreate?: PatientPayload | undefined;
  reasonForCx: string;
  reasonForDev: string;
};

export type ParsedPatientRecord = {
  status: PatientImportEntryStatusParsed;
  patientCreate: PatientPayload;
};

export type PatientRecord = {
  cxId: string;
  jobId: string;
  rowNumber: number;
  rowCsv: string;
  patientId?: string | undefined;
} & (FailedPatientRecord | ParsedPatientRecord);

export type PatientMapping = {
  rowNumber: number;
  patientId: string;
};

export type PatientPayload = PatientDemoData & { externalId: string | undefined };

export type ParsedPatientBase = { rowNumber: number; raw: string };

export type ParsedPatientSuccess = ParsedPatientBase & {
  parsed: PatientPayload;
  error?: undefined;
};

export type ParsedPatientError = ParsedPatientBase & { parsed?: undefined; error: string };

export type ParsedPatient = ParsedPatientSuccess | ParsedPatientError;

export function isParsedPatientSuccess(parsed: ParsedPatient): parsed is ParsedPatientSuccess {
  return parsed.parsed !== undefined;
}

export function isParsedPatientError(parsed: ParsedPatient): parsed is ParsedPatientError {
  return parsed.parsed === undefined;
}
