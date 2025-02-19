import { RowError } from "@metriport/core/command/patient-import/csv/validate-and-parse-import";
import { PatientPayload } from "@metriport/core/command/patient-import/patient-import";

export function validToString(entry: string[]) {
  return entry.join(",");
}

export function invalidToString(entry: RowError) {
  return entry.rowColumns.map(escapeCsvValueIfNeeded).join(",") + "," + entry.error;
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
