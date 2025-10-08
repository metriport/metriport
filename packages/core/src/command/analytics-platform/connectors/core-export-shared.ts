export function buildCoreSchemaS3Prefix({ cxId }: { cxId: string }): string {
  // TODO we'll prob need to rename the first level to core-schema-export or something, since all external DWH connectors will need the files there.
  // Unless we're willing to copy the output core schema files to many folders, which seems inneficient.
  return `snowflake/core-schema/cx=${cxId}`;
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
