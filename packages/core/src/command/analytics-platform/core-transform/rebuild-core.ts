import {
  getCxsEnabledForAnalyticsIncrementalIngestion,
  isAnalyticsIncrementalIngestionEnabledForCx,
} from "../../feature-flags/domain-ffs";
import { BadRequestError } from "@metriport/shared";
import { executeAsynchronously } from "../../../util/concurrency";
import { buildCoreTransformHandler } from "./coordinator/core-transform-factory";
import { out } from "../../../util/log";

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

  log(`Rebuilding core schemas for ${cxIds.length} cxIds: ${cxIds.join(", ")}`);

  await executeAsynchronously(
    cxIds,
    async cxId => {
      const coreTransformHandler = buildCoreTransformHandler();
      await coreTransformHandler.processCoreTransform({ cxId });
    },
    {
      numberOfParallelExecutions: 10,
    }
  );

  return cxIds;
}
