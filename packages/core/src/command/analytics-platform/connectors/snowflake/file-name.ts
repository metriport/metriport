import { MetriportError } from "@metriport/shared";

export function buildSnowflakeS3Prefix({ cxId }: { cxId: string }): string {
  return `snowflake/core-schema/cx=${cxId}`;
}

export function buildSnowflakeTableS3Key({
  cxId,
  jobId,
  s3Key,
}: {
  cxId: string;
  jobId: string;
  s3Key: string;
}): string {
  const fileName = s3Key.split("/").pop();
  if (!fileName) {
    throw new MetriportError(`No file name found in s3 key`, undefined, { s3Key });
  }
  return `${buildSnowflakeS3Prefix({ cxId })}/job=${jobId}/${fileName}`;
}
