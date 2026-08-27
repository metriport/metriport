import { BadRequestError, errorToString } from "@metriport/shared";
import { executeAsynchronously } from "../../util/concurrency";
import { Config } from "../../util/config";
import { out } from "../../util/log";
import { capture } from "../../util/notifications";
import {
  getCxsEnabledForAnalyticsIncrementalIngestion,
  isAnalyticsIncrementalIngestionEnabledForCx,
} from "../feature-flags/domain-ffs";
import { buildCoreToHedisHandler } from "./core-to-hedis/command/core-to-hedis-factory";
import { getCxFwhName } from "./fwh/utils";

const amountOfCoreTransformExecutedInParallel = 5;

/**
 * Rebuilds the HEDIS for a given cxId.
 * If cxId is not provided, it will rebuild the HEDIS for all cxIds that have the analytics
 * incremental ingestion feature flag enabled.
 *
 * @param cxId - The cxId to rebuild the HEDIS for.
 * @returns The cxIds that HEDIS rebuild was initiated for and the cxIds that failed.
 */
export async function rebuildHedis({
  cxId,
}: {
  cxId?: string;
}): Promise<{ successful: string[]; failed: string[] }> {
  const { log } = out(`rebuildHedis - cx ${cxId ?? "all"}`);

  if (cxId) {
    const isAnalyticsEnabled = await isAnalyticsIncrementalIngestionEnabledForCx(cxId);
    if (!isAnalyticsEnabled) {
      throw new BadRequestError(`Analytics is not enabled for cx`, undefined, { cxId });
    }
  }

  const cxIds = cxId ? [cxId] : await getCxsEnabledForAnalyticsIncrementalIngestion();
  if (cxIds.length < 1) {
    log(`No cxs to rebuild HEDIS for`);
    return { successful: [], failed: [] };
  }

  const dbCreds = Config.getAnalyticsDbCreds();

  log(`Rebuilding HEDIS for ${cxIds.length} cxIds: ${cxIds.join(", ")}`);

  const errors: { cxId: string; error: unknown }[] = [];
  await executeAsynchronously(
    cxIds,
    async cxId => {
      try {
        log(`Rebuilding HEDIS for ${cxId}`);
        const cxFwhName = getCxFwhName({ cxId, dbname: dbCreds.dbname });
        const coreToHedisHandler = buildCoreToHedisHandler();
        await coreToHedisHandler.processCoreToHedis({
          cxId,
          database: cxFwhName,
        });
      } catch (error) {
        log(`Error rebuilding HEDIS for ${cxId}: ${errorToString(error)}`);
        errors.push({ cxId, error });
      }
    },
    {
      numberOfParallelExecutions: amountOfCoreTransformExecutedInParallel,
    }
  );
  const failedCxIds = errors.map(e => e.cxId);
  const successfulCxIds = cxIds.filter(cxId => !failedCxIds.includes(cxId));
  if (errors.length > 0) {
    const msg = `Errors rebuilding HEDIS`;
    const errorsString = errors.map(e => `${e.cxId}: ${errorToString(e.error)}`).join(", ");
    log(`${msg}: ${errorsString}`);
    capture.error(msg, {
      extra: { errors: errorsString, failedCxIds: failedCxIds.join(", ") },
    });
  }

  return { successful: successfulCxIds, failed: failedCxIds };
}
