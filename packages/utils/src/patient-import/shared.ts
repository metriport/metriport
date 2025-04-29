import {
  ParsedPatientError,
  ParsedPatientSuccess,
  PatientPayload,
} from "@metriport/core/command/patient-import/patient-import";

export function validToString(parsed: ParsedPatientSuccess) {
  return parsed.raw;
}

export function invalidToString(parsed: ParsedPatientError) {
  return escapeCsvValueIfNeeded(parsed.raw) + "," + parsed.error;
}

function escapeCsvValueIfNeeded(value: string) {
  if (value.includes(",")) {
    return `"${value}"`;
  }
  return value;
}

export function patientValidationToString(request: PatientPayload) {
  return JSON.stringify(request);
}

export function patientCreationToString(request: PatientPayload) {
  return JSON.stringify(request);
}
