export const metaFolderName = "_meta";

export function buildCoreSchemaS3Prefix({ cxId, jobId }: { cxId: string; jobId: string }): string {
  return `ingestion/export-core-from-fwh-to-s3/cx=${cxId}/job=${jobId}`;
}

export function buildCoreSchemaMetaS3Prefix({
  cxId,
  jobId,
}: {
  cxId: string;
  jobId: string;
}): string {
  return `${buildCoreSchemaS3Prefix({ cxId, jobId })}/${metaFolderName}`;
}

export function buildCoreSchemaMetaTableS3Prefix({
  cxId,
  jobId,
  tableName,
}: {
  cxId: string;
  jobId: string;
  tableName: string;
}): string {
  return `${buildCoreSchemaMetaS3Prefix({ cxId, jobId })}/${tableName}.csv`;
}

export function buildCoreTableS3Prefix({
  cxId,
  jobId,
  tableName,
}: {
  cxId: string;
  jobId: string;
  tableName: string;
}): string {
  return `${buildCoreSchemaS3Prefix({ cxId, jobId })}/${tableName}.csv`;
}

export function parseTableNameFromCoreTableS3Prefix(s3Key: string): string | undefined {
  // e.g. of file.key: snowflake/core-schema/cx=eae9172a-1c55-437b-bc1a-9689c64e47a1/condition.csv
  return s3Key.split("/").pop()?.split(".")[0];
}
