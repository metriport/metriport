import { MetriportError } from "@metriport/shared";

// TODO ENG-954 Build specific versions of these for bulk and incremental ingestion and update the places that call them

export function buildFhirToCsvBulkBasePrefix(cxId: string): string {
  return `snowflake/fhir-to-csv/cx=${cxId}`;
}

export function buildFhirToCsvBulkJobPrefix({
  cxId,
  jobId,
}: {
  cxId: string;
  jobId: string;
}): string {
  return `${buildFhirToCsvBulkBasePrefix(cxId)}/f2c=${jobId}`;
}

export function buildFhirToCsvBulkPatientPrefix({
  cxId,
  jobId,
  patientId,
}: {
  cxId: string;
  jobId: string;
  patientId: string;
}): string {
  return `${buildFhirToCsvBulkJobPrefix({ cxId, jobId })}/pt=${patientId}`;
}

export function parseTableNameFromFhirToCsvBulkFileKey(key: string): string {
  // e.g.: snowflake/fhir-to-csv/cx=cx-id/f2c=2025-08-08T02-18-56/pt=patient-id/_tmp_fhir-to-csv_output_cx-id_patient-id_condition.csv
  const tableName = key.split("/").pop()?.split("_").slice(6).join("_").split(".")[0];
  if (!tableName) {
    throw new MetriportError(`Failed to parse tableName from fhirToCsvFileKey`, undefined, { key });
  }
  return tableName;
}

export function parsePatientIdFromFhirToCsvBulkPatientPrefix(key: string): string {
  // e.g.: snowflake/fhir-to-csv/cx=cx-id/f2c=2025-08-08T02-18-56/pt=patient-id/
  const withoutSlash = key.endsWith("/") ? key.slice(0, -1) : key;
  const patientId = withoutSlash.split("/").pop()?.replace("pt=", "");
  if (!patientId) {
    throw new MetriportError(`Failed to parse patientId from fhirToCsvFileKey`, undefined, { key });
  }
  return patientId;
}
