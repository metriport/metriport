import { RateLimitOperation } from "@metriport/shared/src/domain/rate-limiting";
import { DynamoDbUtils } from "../../../external/aws/dynamodb";
import { Config } from "../../../util/config";
import { createPrimaryKey } from "../shared";

const region = Config.getAWSRegion();

export async function updateTrackedOperationCount({
  cxId,
  operation,
  end,
}: {
  cxId: string;
  operation: RateLimitOperation;
  end: string;
}): Promise<void> {
  const trackingTableName = Config.getRateLimitingTrackingTableName();
  if (!trackingTableName) return undefined;
  const primaryKey = createPrimaryKey({ cxId, operation });
  const ddbUtils = new DynamoDbUtils(region, trackingTableName, primaryKey);

  const expression = "set count = count + :num";
  const conditionExpression = "timestamp = :end`";
  const expressionAttributesValues = { ":num": { N: "1" }, ":end": { S: end } };
  await ddbUtils.update({
    expression,
    conditionExpression,
    expressionAttributesValues,
  });
}
