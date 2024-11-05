import { MetriportError } from "@metriport/shared";
import {
  RateLimitOperation,
  RateLimit,
  rateLimitEntrySchema,
} from "@metriport/shared/src/domain/rate-limiting";
import { DynamoDbUtils } from "../../../external/aws/dynamodb";
import { Config } from "../../../util/config";
import { createPrimaryKey, defaultOperationLimits } from "../shared";

const region = Config.getAWSRegion();

export async function getCxRateSettingValue({
  cxId,
  operation,
  rateLimit,
  create = true,
}: {
  cxId: string;
  operation: RateLimitOperation;
  rateLimit: RateLimit;
  create?: boolean;
}): Promise<number | undefined> {
  const settingsTableName = Config.getRateLimitingSettingsTableName();
  if (!settingsTableName) return undefined;
  const primaryKey = createPrimaryKey({ cxId, operation });
  const ddbUtils = new DynamoDbUtils(region, settingsTableName, primaryKey);

  const rateLimits = await ddbUtils.getByKey({});
  if (!rateLimits.Item) {
    if (!create) return undefined;
    const newLimits = defaultOperationLimits.get(operation);
    if (!newLimits) return undefined;
    const expressionList = [];
    const expressionAttributesValuesList = [];
    for (const [limit, value] of newLimits) {
      const attrValueKey = `:${limit}`;
      expressionList.push(`set ${limit} = ${attrValueKey}`);
      expressionAttributesValuesList.push({ [attrValueKey]: { N: `${value}` } });
    }
    if (expressionList.length === 0) {
      throw new MetriportError("Experssion empty", undefined, { operation });
    }
    if (expressionAttributesValuesList.length === 0) {
      throw new MetriportError("Experssion attributes empty", undefined, { operation });
    }
    ddbUtils.update({
      expression: expressionList.join(","),
      expressionAttributesValues: expressionAttributesValuesList.reduce((payload, current) => {
        return { ...payload, ...current };
      }, {}),
    });
    return undefined;
  }
  const rateLimitEntry = rateLimitEntrySchema.safeParse(rateLimits.Item);
  if (!rateLimitEntry.success) {
    // TODO Throw error
    return undefined;
  }
  return +rateLimitEntry.data[rateLimit].N;
}
