import { MetriportError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import {
  RateLimitOperation,
  trackingEntriesSchema,
} from "@metriport/shared/src/domain/rate-limiting";
import { DynamoDbUtils } from "../../../external/aws/dynamodb";
import { Config } from "../../../util/config";
import { createPrimaryKey } from "../shared";

const region = Config.getAWSRegion();

function validateStartAndEnd(start: string, end: string) {
  const startJs = buildDayjs(start);
  if (startJs.millisecond() !== 0)
    throw new MetriportError("Start is not second granularity", undefined, { start });
  const endJs = buildDayjs(end);
  if (endJs.millisecond() !== 0)
    throw new MetriportError("End is not second granularity", undefined, { start });
  if (endJs.isBefore(startJs))
    throw new MetriportError("end is before start", undefined, { start, end });
}

export async function getTrackedOperationCountSum({
  cxId,
  operation,
  start,
  end,
}: {
  cxId: string;
  operation: RateLimitOperation;
  start: string;
  end: string;
}): Promise<number | undefined> {
  validateStartAndEnd(start, end);
  const trackingTableName = Config.getRateLimitingTrackingTableName();
  if (!trackingTableName) return undefined;
  const primaryKey = createPrimaryKey({ cxId, operation });
  const ddbUtils = new DynamoDbUtils(region, trackingTableName, primaryKey);

  const trackings = await ddbUtils.query({
    keyConditionExpression: "timestamp BETWEEN :start AND :end",
    expressionAttributesValues: { ":start": { S: start }, ":end": { S: end } },
  });
  if (!trackings.Items) return undefined;
  const trackingEntries = trackingEntriesSchema.safeParse(trackings.Items);
  if (!trackingEntries.success) {
    // TODO Throw error
    return undefined;
  }
  return trackingEntries.data.reduce((sum, current) => sum + +current.count.N, 0);
}
