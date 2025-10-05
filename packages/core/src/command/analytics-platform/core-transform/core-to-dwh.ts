import { DbCreds, DbCredsWithSchema } from "@metriport/shared";
import { coreSchemaName } from "../../../domain/analytics/core-schema";
import { capture, out } from "../../../util";
import { isDatawarehouseSnowflakeEnabledForCx } from "../../feature-flags/domain-ffs";
import { buildSnowflakeIngestor } from "../connectors/snowflake/snowflake-ingestor-factory";
import { exportCoreToS3 } from "./core-to-s3";

export type DataWarehouses = "snowflake";

/**
 * Exports the core schema to DWHs.
 */
export async function exportCoreToExternalDatawarehouses({
  cxId,
  dbCreds,
  schemaName = coreSchemaName,
  analyticsBucketName,
  region,
}: {
  cxId: string;
  dbCreds: DbCreds;
  schemaName?: string | undefined;
  analyticsBucketName: string;
  region: string;
}): Promise<void> {
  const { log } = out(`exportCoreToExternalDatawarehouses - cx ${cxId}`);

  capture.setExtra({ cxId, dbName: dbCreds.dbname });
  log(
    `Running with params: ${JSON.stringify({
      host: dbCreds.host,
      port: dbCreds.port,
      dbname: dbCreds.dbname,
      username: dbCreds.username,
      analyticsBucketName,
    })}`
  );

  const isSnowflakeEnabled = await isDatawarehouseSnowflakeEnabledForCx(cxId);

  const isExternalDatawarehousesEnabled = isSnowflakeEnabled;

  if (!isExternalDatawarehousesEnabled) {
    log(`No external data warehouses enabled for this customer`);
    return;
  }

  const dbCredsWithSchema: DbCredsWithSchema = {
    ...dbCreds,
    schemaName,
  };

  await exportCoreToS3({ cxId, dbCreds: dbCredsWithSchema, analyticsBucketName, region });

  if (isSnowflakeEnabled) {
    const ingestor = buildSnowflakeIngestor();
    await ingestor.ingestCoreIntoSnowflake({ cxId });
  }
}
