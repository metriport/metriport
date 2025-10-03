import { MetriportError } from "@metriport/shared";

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
  // e.g.: snowflake/fhir-to-csv/cx=cx-id/f2c=2025-08-08T02-18-56/pt=patient-id/
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

export function buildFhirToCsvIncrementalJobPrefix({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): string {
  return `snowflake/fhir-to-csv-incremental/cx=${cxId}/pt=${patientId}`;
}

export function parseTableNameFromFhirToCsvIncrementalFileKey(key: string): string {
  // e.g.: snowflake/fhir-to-csv-incremental/cx=eae9172a-1c55-437b-bc1a-9689c64e47a1/pt=0194f5f7-c165-7c48-b7fe-cf1f4da02e17/patient.csv
  const fileNameWithExt = key.split("/").pop();
  const tableName =
    fileNameWithExt?.substring(0, fileNameWithExt.lastIndexOf(".")) ?? fileNameWithExt;
  if (!tableName) {
    throw new MetriportError(
      `Failed to parse tableName from fhirToCsvIncrementalFileKey`,
      undefined,
      { key }
    );
  }
  return tableName;
}

export function parseResourceTypeFromConfigurationFileName(fileName: string): string {
  const resourceType = fileName.split("_").slice(1).join("_")?.replace(".ini", "")?.toLowerCase();
  if (!resourceType) {
    throw new MetriportError(
      `Failed to parse resourceType from configuration fileName`,
      undefined,
      { fileName }
    );
  }
  return resourceType;
}

export function buildCoreSchemaS3Prefix({ cxId }: { cxId: string }): string {
  return `core-schema/cx=${cxId}`;
}
export function buildCoreTableS3Prefix({
  cxId,
  tableName,
}: {
  cxId: string;
  tableName: string;
}): string {
  return `${buildCoreSchemaS3Prefix({ cxId })}/${tableName}.csv`;
}
