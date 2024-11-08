import {
  errorToString,
  MetriportError,
  RateLimitOperation,
  trackingEntriesSchema,
} from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { DynamoDbUtils } from "../../../external/aws/dynamodb";
import { capture, out } from "../../../util";
import { Config } from "../../../util/config";
import { createPrimaryKey, createPrimaryKeyValue } from "../shared";

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
  client,
}: {
  cxId: string;
  operation: RateLimitOperation;
  start: string;
  end: string;
  client?: DocumentClient | undefined;
}): Promise<number | undefined> {
  const { log } = out(`getCxRateSettingValue - cxId ${cxId} operation ${operation}`);
  validateStartAndEnd(start, end);
  const trackingTableName = Config.getRateLimitingTrackingTableName();
  if (!trackingTableName) return undefined;
  const primaryKey = createPrimaryKey({ cxId, operation });
  const ddbUtils = new DynamoDbUtils(region, trackingTableName, primaryKey, client);

  const trackings = await ddbUtils.query({
    keyConditionExpression:
      "cxId_operation = :primaryKeyValue and window_timestamp BETWEEN :start AND :end",
    expressionAttributesValues: {
      ":primaryKeyValue": createPrimaryKeyValue({ cxId, operation }),
      ":start": start,
      ":end": end,
    },
  });
  if (!trackings.Items) return undefined;
  const trackingEntries = trackingEntriesSchema.safeParse(trackings.Items);
  if (!trackingEntries.success) {
    const error = trackingEntries.error;
    const msg = `Error parsing DDB rate limit tracking entries`;
    log(`${msg} - error: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        cxId,
        operation,
        context: "rate-limiting.getTrackedOperationCountSum",
        error,
      },
    });
    return undefined;
  }
  return trackingEntries.data.reduce((sum, current) => sum + current.numberOfOperation, 0);
}
