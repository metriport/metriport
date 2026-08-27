import { Config } from "../../util/config";
import { out } from "../../util/log";
import { getCxFwhName } from "./fwh/utils";
import { buildRawToCoreHandler } from "./raw-to-core/command/raw-to-core-factory";

/**
 * Rebuilds the core schemas for a given cxId.
 *
 * @param cxId - The cxId to rebuild the core schemas for.
 * @returns The jobId of the raw to core job.
 */
export async function rebuildCore({ cxId }: { cxId: string }): Promise<string> {
  const { log } = out(`rebuildCore - cx ${cxId}`);

  const dbCreds = Config.getAnalyticsDbCreds();
  log(`Rebuilding core schema with full refresh`);

  const cxFwhName = getCxFwhName({ cxId, dbname: dbCreds.dbname });
  const rawToCoreHandler = buildRawToCoreHandler();
  const jobId = await rawToCoreHandler.processRawToCore({
    cxId,
    database: cxFwhName,
    fullRefresh: true,
  });

  return jobId;
}
