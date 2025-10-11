export const metaFolderName = "_meta";

export function buildCoreSchemaS3Prefix({ cxId }: { cxId: string }): string {
  // TODO we'll prob need to rename the first level to core-schema-export or something, since all external DWH connectors will need the files there.
  // Unless we're willing to copy the output core schema files to many folders, which seems inneficient.
  return `snowflake/core-schema/cx=${cxId}`;
}

export function buildCoreSchemaMetaS3Prefix({ cxId }: { cxId: string }): string {
  return `${buildCoreSchemaS3Prefix({ cxId })}/${metaFolderName}`;
}

export function buildCoreSchemaMetaTableS3Prefix({
  cxId,
  tableName,
}: {
  cxId: string;
  tableName: string;
}): string {
  return `${buildCoreSchemaMetaS3Prefix({ cxId })}/${tableName}.csv`;
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

export function parseTableNameFromCoreTableS3Prefix(s3Key: string): string | undefined {
  return s3Key.split("/").pop()?.split(".")[0];
}
