import { MetriportError, RateLimit, RateLimitOperation } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { getCxRateSettingValue } from "./command/get-settings";
import { getTrackedOperationCountSum } from "./command/get-tracked-operation-count-sum";
import { updateTrackedOperationCount } from "./command/update-tracked-operation-count";
import { secondGranularityIsoDateTime, secondsLookup } from "./shared";

export async function checkRateLimit({
  cxId,
  operation,
  rateLimit,
  client,
}: {
  cxId: string;
  operation: RateLimitOperation;
  rateLimit: RateLimit;
  client?: DocumentClient;
}): Promise<boolean> {
  const secondsLookback = secondsLookup.get(rateLimit);
  if (!secondsLookback)
    throw new MetriportError("Operation missing seconds lookup", undefined, { operation });

  const end = buildDayjs();
  const endStr = end.format(secondGranularityIsoDateTime);
  const start = end.subtract(secondsLookback, "seconds");
  const startStr = start.format(secondGranularityIsoDateTime);
  const [currentCount, limit] = await Promise.all([
    getTrackedOperationCountSum({
      cxId,
      operation,
      start: startStr,
      end: endStr,
      client,
    }),
    getCxRateSettingValue({
      cxId,
      operation,
      rateLimit,
      client,
    }),
  ]);
  if (currentCount === undefined || limit === undefined) return true;
  if (currentCount > limit) return false;
  updateTrackedOperationCount({
    cxId,
    operation,
    end: endStr,
    client,
  });
  return true;
}
