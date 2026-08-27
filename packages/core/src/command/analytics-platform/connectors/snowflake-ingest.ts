import { BadRequestError } from "@metriport/shared";
import { isDatawarehouseSnowflakeEnabledForCx } from "../../feature-flags/domain-ffs";
import { buildSnowflakeIngestor } from "./snowflake/snowflake-ingestor-factory";

export async function snowflakeIngest({
  cxId,
  coreExportJobId,
}: {
  cxId: string;
  coreExportJobId: string;
}): Promise<string> {
  const isSnowflakeIngestionEnabled = await isDatawarehouseSnowflakeEnabledForCx(cxId);
  if (!isSnowflakeIngestionEnabled) {
    throw new BadRequestError(
      `Datawarehouse Snowflake ingestion is not enabled for cx`,
      undefined,
      { cxId }
    );
  }

  const snowflakeIngestor = buildSnowflakeIngestor();
  const jobId = await snowflakeIngestor.ingestCoreIntoSnowflake({ cxId, coreExportJobId });

  return jobId;
}
