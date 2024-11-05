import { MetriportError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { RateLimitOperation, RateLimit } from "@metriport/shared/src/domain/rate-limiting";
import { getCxRateSettingValue } from "./command/get-settings";
import { getTrackedOperationCountSum } from "./command/get-tracked-operation-count-sum";
import { updateTrackedOperationCount } from "./command/update-tracked-operation-count";
import { secondsLookup, secondGranularityIsoDateTime } from "./shared";

export async function checkRateLimit({
  cxId,
  operation,
  rateLimit,
}: {
  cxId: string;
  operation: RateLimitOperation;
  rateLimit: RateLimit;
}): Promise<boolean> {
  const secondsLookback = secondsLookup.get(rateLimit);
  if (!secondsLookback)
    throw new MetriportError("Operation missing seconds lookup", undefined, { operation });

  const end = buildDayjs();
  const start = end.subtract(secondsLookback, "seconds");
  const [currentCount, limit] = await Promise.all([
    getTrackedOperationCountSum({
      cxId,
      operation,
      start: start.format(secondGranularityIsoDateTime),
      end: end.format(secondGranularityIsoDateTime),
    }),
    getCxRateSettingValue({
      cxId,
      operation,
      rateLimit,
    }),
  ]);
  if (!currentCount || !limit) return true;
  if (currentCount > limit) return false;
  updateTrackedOperationCount({
    cxId,
    operation,
  });
  return true;
}
