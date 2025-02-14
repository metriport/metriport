import { PatientPayload } from "@metriport/core/command/patient-import/patient-import";
import { RowError } from "@metriport/core/command/patient-import/csv/validate-and-parse-import";

export function validToString(entry: string[]) {
  return entry.join(",");
}

export function invalidToString(entry: RowError) {
  return entry.rowColumns.join(",") + "," + entry.error;
}

export function patientValidationToString(request: PatientPayload) {
  return JSON.stringify(request);
}

export function patientCreationToString(request: PatientPayload) {
  return JSON.stringify(request);
}
