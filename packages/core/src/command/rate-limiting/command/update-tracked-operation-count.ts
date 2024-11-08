import { RateLimitOperation } from "@metriport/shared";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { DynamoDbUtils } from "../../../external/aws/dynamodb";
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
  const trackingTableName = Config.getRateLimitingTrackingTableName();
  if (!trackingTableName) return undefined;
  const primaryKey = createPrimaryKey({ cxId, operation });
  const ddbUtils = new DynamoDbUtils(region, trackingTableName, primaryKey, client);

  await ddbUtils.update({
    sortKey: { window_timestamp: end },
    expression: "ADD numberOfOperation :inc",
    expressionAttributesValues: {
      ":inc": 1,
    },
  });
}
