import { BadRequestError, uuidv4 } from "@metriport/shared";
import { executeAsynchronously } from "../../../util/concurrency";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import {
  getCxsEnabledForAnalyticsIncrementalIngestion,
  isAnalyticsIncrementalIngestionEnabledForCx,
} from "../../feature-flags/domain-ffs";
import { getCxDbName, rawDbSchema } from "../csv-to-db/db-asset-defs";
import { buildCoreTransformHandler } from "./coordinator/core-transform-factory";

const amountOfCoreTrannsformExecutedInParallel = 5;

/**
 * Rebuilds the core schemas for a given cxId.
 * If cxId is not provided, it will rebuild the core schemas for all cxIds that have the analytics
 * incremental ingestion feature flag enabled.
 *
 * @param cxId - The cxId to rebuild the core schemas for.
 * @returns The cxIds that core schema rebuild was initiated for.
 */
export async function rebuildCoreSchemas({ cxId }: { cxId?: string }): Promise<string[]> {
  const { log } = out(`rebuildCoreSchemas - cx ${cxId ?? "all"}`);

  if (cxId) {
    const isAnalyticsEnabled = await isAnalyticsIncrementalIngestionEnabledForCx(cxId);
    if (!isAnalyticsEnabled) throw new BadRequestError(`Analytics is not enabled for cx ${cxId}`);
  }

  const cxIds = cxId ? [cxId] : await getCxsEnabledForAnalyticsIncrementalIngestion();
  if (cxIds.length < 1) log(`No cxs to rebuild core schema for`);

  const dbCreds = Config.getAnalyticsDbCreds();

  log(`Rebuilding core schemas for ${cxIds.length} cxIds: ${cxIds.join(", ")}`);

  await executeAsynchronously(
    cxIds,
    async cxId => {
      const jobId = uuidv4();
      log(`Rebuilding core schema for ${cxId}, jobId: ${jobId}`);
      const cxDbName = getCxDbName(cxId, dbCreds.dbname);
      const coreTransformHandler = buildCoreTransformHandler();
      await coreTransformHandler.processCoreTransform({
        cxId,
        jobId,
        databaseName: cxDbName,
        schemaName: rawDbSchema,
      });
    },
    {
      numberOfParallelExecutions: amountOfCoreTrannsformExecutedInParallel,
    }
  );

  return cxIds;
}
