import { MetriportError } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { DynamoDbUtils } from "../../external/aws/dynamodb";
import { sendHeartbeatToMonitoringService } from "../../external/monitoring/heartbeat";
import { Config } from "../../util/config";

dayjs.extend(duration);

const HEARTBEAT_RATE_LIMIT_WINDOW = dayjs.duration(2, "minutes");

function isConditionalCheckFailedError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  return (
    ("name" in error && error.name === "ConditionalCheckFailedException") ||
    ("code" in error && error.code === "ConditionalCheckFailedException") ||
    ("Code" in error && error.Code === "ConditionalCheckFailedException")
  );
}

export async function sendHeartbeat(hieName: string, log: typeof console.log): Promise<void> {
  const heartbeatMap = Config.getHeartBeatMonitorMap();
  const monitorUrl = heartbeatMap[hieName];
  if (!monitorUrl) {
    log(`Heartbeat monitor URL not found for ${hieName}`);
    throw new MetriportError(`Heartbeat monitor URL not found for ${hieName}`, undefined, {
      hieName,
    });
  }

  const isAllowedToPing = await shouldPing(hieName);
  log(`Is allowed to ping ${hieName} monitor: ${isAllowedToPing}`);
  if (!isAllowedToPing) {
    return;
  }

  await sendHeartbeatToMonitoringService(monitorUrl);
  log(`Sent ping to ${hieName} heartbeat monitor`);
}

async function shouldPing(hieName: string): Promise<boolean> {
  const heartbeatTableName = Config.getHeartbeatRateLimitTableName();
  const ddb = new DynamoDbUtils({ table: heartbeatTableName, partitionKey: "heartbeatKey" });
  const key = ddb.createKey(`heartbeat-rate-limit#${hieName}`, undefined);
  const nowMs = Date.now();
  const nextAllowedPingAtMs = nowMs + HEARTBEAT_RATE_LIMIT_WINDOW.asMilliseconds();

  try {
    await ddb._docClient
      .update({
        TableName: ddb._table,
        Key: key,
        UpdateExpression:
          "SET nextAllowedPingAtMs = :nextAllowedPingAtMs, lastPingAtMs = :nowMs, hieName = :hieName",
        ConditionExpression:
          "attribute_not_exists(nextAllowedPingAtMs) OR :nowMs >= nextAllowedPingAtMs",
        ExpressionAttributeValues: {
          ":nextAllowedPingAtMs": nextAllowedPingAtMs,
          ":nowMs": nowMs,
          ":hieName": hieName,
        },
        ReturnValues: "NONE",
      })
      .promise();
    return true;
  } catch (error: unknown) {
    if (isConditionalCheckFailedError(error)) {
      return false;
    }
    throw new MetriportError("Failed to update heartbeat record", error, { hieName });
  }
}
