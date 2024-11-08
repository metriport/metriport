import {
  errorToString,
  MetriportError,
  RateLimit,
  rateLimitEntrySchema,
  RateLimitOperation,
} from "@metriport/shared";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { DynamoDbUtils } from "../../../external/aws/dynamodb";
import { capture, out } from "../../../util";
import { Config } from "../../../util/config";
import { createPrimaryKey, defaultOperationLimits } from "../shared";

const region = Config.getAWSRegion();

export async function getCxRateSettingValue({
  cxId,
  operation,
  rateLimit,
  create = true,
  client,
}: {
  cxId: string;
  operation: RateLimitOperation;
  rateLimit: RateLimit;
  create?: boolean;
  client?: DocumentClient | undefined;
}): Promise<number | undefined> {
  const { log } = out(
    `getCxRateSettingValue - cxId ${cxId} operation ${operation} rateLimit ${rateLimit}`
  );
  const settingsTableName = Config.getRateLimitingSettingsTableName();
  if (!settingsTableName) return undefined;
  const primaryKey = createPrimaryKey({ cxId, operation });
  const ddbUtils = new DynamoDbUtils(region, settingsTableName, primaryKey, client);
  try {
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
        expressionAttributesValuesList.push({ [attrValueKey]: value });
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
      const error = rateLimitEntry.error;
      const msg = `Error parsing DDB rate limit settings entry`;
      log(`${msg} - error: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          cxId,
          operation,
          rateLimit,
          context: "rate-limiting.getCxRateSettingValue",
          error,
        },
      });
      return undefined;
    }
    return rateLimitEntry.data[rateLimit];
  } catch (error) {
    const msg = `Failure getting settings @ RateLimiting`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        cxId,
        operation,
        rateLimit,
        context: "rate-limiting.get-settings",
        error,
      },
    });
    throw error;
  }
}
