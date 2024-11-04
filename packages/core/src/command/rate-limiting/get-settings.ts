import { settingsEntry } from "@metriport/shared/src/interface/external/aws/dynamodb";
import { DynamoDbUtils } from "../../external/aws/dynamodb";
import { Config } from "../../util/config";
import { createPrimaryKey } from "./shared";

const region = Config.getAWSRegion();

export async function getCxRateSettings({ cxId, operation }: { cxId: string; operation: string }) {
  const settingsTableName = Config.getRateLimitingSettingsTableName();
  if (!settingsTableName) return undefined;
  const primaryKey = createPrimaryKey({ cxId, operation });
  const ddbUtils = new DynamoDbUtils(region, settingsTableName, primaryKey);
  const settings = await ddbUtils.getByPrimaryKey();
  if (!settings.Item) return undefined;
  const settingsDetials = settingsEntry.safeParse(settings);
  if (!settingsDetials) {
    // TODO Throw error
    return undefined;
  }
  return settingsDetials;
}
