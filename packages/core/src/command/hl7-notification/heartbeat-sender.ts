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

export async function sendHeartbeat(hieName: string): Promise<void> {
  const heartbeatMap = Config.getHeartBeatMonitorMap();
  const monitorUrl = heartbeatMap[hieName];
  if (!monitorUrl) {
    throw new MetriportError(`Heartbeat monitor URL not found for ${hieName}`, undefined, {
      hieName,
    });
  }

  const isAllowedToPing = await shouldSendHeartbeat(hieName);
  if (!isAllowedToPing) return;

  await sendHeartbeatToMonitoringService(monitorUrl);
}

async function shouldSendHeartbeat(hieName: string): Promise<boolean> {
  const outboundRateLimitTableName = Config.getOutboundRateLimitTableName();
  if (!outboundRateLimitTableName) return true;
  const ddb = new DynamoDbUtils({ table: outboundRateLimitTableName, partitionKey: "outboundKey" });
  const key = ddb.createKey(`heartbeat-rate-limit#${hieName}`);
  const nowMs = Date.now();
  const nextAllowedPingAtMs = nowMs + HEARTBEAT_RATE_LIMIT_WINDOW.asMilliseconds();

  try {
    await ddb._docClient
      .update({
        TableName: ddb._table,
        Key: key,
        UpdateExpression:
          "SET nextAllowedRequestAtMs = :nextAllowedRequestAtMs, lastRequestAtMs = :nowMs, identifier = :identifier",
        ConditionExpression:
          "attribute_not_exists(nextAllowedRequestAtMs) OR :nowMs >= nextAllowedRequestAtMs",
        ExpressionAttributeValues: {
          ":nextAllowedRequestAtMs": nextAllowedPingAtMs,
          ":nowMs": nowMs,
          ":identifier": hieName,
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
