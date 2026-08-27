import { BadRequestError, errorToString, uuidToDelaySeconds } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import { Duration } from "dayjs/plugin/duration";
import { executeAsynchronously } from "../../util/concurrency";
import { Config } from "../../util/config";
import { out } from "../../util/log";
import { capture } from "../../util/notifications";
import {
  getCxsEnabledForAnalyticsIncrementalRawToCore,
  isAnalyticsIncrementalRawToCoreEnabledForCx,
} from "../feature-flags/domain-ffs";
import { getCxFwhName } from "./fwh/utils";
import { buildRawToCoreHandler } from "./raw-to-core/command/raw-to-core-factory";

const amountOfCoreTransformExecutedInParallel = 5;
const maxDelaySeconds = 600; // 10 minutes

/**
 * Rebuilds the core schema incrementally for a given cxId.
 *
 * @param cxId - The cxId to rebuild the core schema incrementally for.
 * @returns The jobId of the raw to core job.
 */
export async function rebuildCoreIncremental({
  cxId,
  lookbackTimestamp,
  lookbackHours,
  delay,
}: {
  cxId?: string;
  lookbackTimestamp?: dayjs.Dayjs;
  lookbackHours?: number;
  delay?: Duration;
}): Promise<{ successful: string[]; failed: string[] }> {
  const { log } = out(`rebuildCoreIncremental - cx ${cxId ?? "all"}`);

  if (cxId) {
    const isAnalyticsEnabled = await isAnalyticsIncrementalRawToCoreEnabledForCx(cxId);
    if (!isAnalyticsEnabled) {
      throw new BadRequestError(`Analytics is not enabled for cx`, undefined, { cxId });
    }
  }

  const cxIds = cxId ? [cxId] : await getCxsEnabledForAnalyticsIncrementalRawToCore();
  if (cxIds.length < 1) {
    log(`No cxs to rebuild core schema for`);
    return { successful: [], failed: [] };
  }
  if (delay !== undefined && delay.asSeconds() > maxDelaySeconds) {
    throw new BadRequestError(`Delay cannot exceed ${maxDelaySeconds} seconds`, undefined, {
      delaySeconds: delay.asSeconds(),
    });
  }
  const delays: Duration[] = cxId
    ? delay
      ? [delay]
      : []
    : cxIds.map(id => dayjs.duration(uuidToDelaySeconds(id, maxDelaySeconds), "seconds"));

  const dbCreds = Config.getAnalyticsDbCreds();

  const lookbackHoursNumber = lookbackHours !== undefined ? Number(lookbackHours) : undefined;
  if (
    lookbackHoursNumber !== undefined &&
    (Number.isNaN(lookbackHoursNumber) || lookbackHoursNumber <= 0)
  ) {
    throw new BadRequestError("Invalid lookbackHours", undefined, { lookbackHours });
  }
  if (lookbackTimestamp && lookbackTimestamp.isAfter(buildDayjs())) {
    throw new BadRequestError("Lookback timestamp must be in the past", undefined, {
      lookbackTimestamp: lookbackTimestamp.toISOString(),
    });
  }
  log(`Rebuilding core schemas for ${cxIds.length} cxIds: ${cxIds.join(", ")}`);

  const errors: { cxId: string; error: unknown }[] = [];
  await executeAsynchronously(
    cxIds,
    async (cxId, itemIndex) => {
      const delayForCx = delays[itemIndex];
      try {
        log(`Rebuilding core schema for ${cxId}`);
        const cxFwhName = getCxFwhName({ cxId, dbname: dbCreds.dbname });
        const rawToCoreHandler = buildRawToCoreHandler();
        await rawToCoreHandler.processRawToCore({
          cxId,
          database: cxFwhName,
          fullRefresh: false,
          ...(lookbackTimestamp !== undefined && { lookbackTimestamp }),
          ...(lookbackHours !== undefined && { lookbackHours }),
          ...(delayForCx !== undefined && { delay: delayForCx }),
        });
      } catch (error) {
        log(`Error rebuilding core schema for ${cxId}: ${errorToString(error)}`);
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
    const msg = `Errors rebuilding core schema`;
    const errorsString = errors.map(e => `${e.cxId}: ${errorToString(e.error)}`).join(", ");
    log(`${msg}: ${errorsString}`);
    capture.error(msg, {
      extra: { errors: errorsString, failedCxIds: failedCxIds.join(", ") },
    });
  }

  return { successful: successfulCxIds, failed: failedCxIds };
}
