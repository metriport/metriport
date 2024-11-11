import { errorToString, RateLimitOperation } from "@metriport/shared";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { DynamoDbUtils } from "../../../external/aws/dynamodb";
import { capture, out } from "../../../util";
import { Config } from "../../../util/config";
import { createPrimaryKey } from "../shared";

const region = Config.getAWSRegion();

export async function updateTrackedOperationCount({
  cxId,
  operation,
  end,
  client,
}: {
  cxId: string;
  operation: RateLimitOperation;
  end: string;
  client?: DocumentClient | undefined;
}): Promise<void> {
  const { log } = out(`updateTrackedOperationCount - cxId ${cxId} operation ${operation}`);
  const trackingTableName = Config.getRateLimitingTrackingTableName();
  if (!trackingTableName) return undefined;
  const primaryKey = createPrimaryKey({ cxId, operation });
  const ddbUtils = new DynamoDbUtils(region, trackingTableName, primaryKey, client);
  try {
    await ddbUtils.update({
      sortKey: { windowTimestamp: end },
      expression: "ADD numberOfOperation :inc",
      expressionAttributesValues: {
        ":inc": 1,
      },
    });
  } catch (error) {
    const msg = `Failure updating tracked operation count @ RateLimiting`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        cxId,
        operation,
        context: "rate-limiting.update-tracked-operation-count",
        error,
      },
    });
    throw error;
  }
}
