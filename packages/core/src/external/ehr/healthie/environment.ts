import { cxApiKeyMapSecretSchema, MetriportError } from "@metriport/shared";
import { HealthieEnv, isHealthieEnv } from ".";
import { Config } from "../../../util/config";
import { EhrEnvAndApiKey, EhrPerPracticeParams } from "../environment";

export function getHealthieEnv({
  cxId,
  practiceId,
}: EhrPerPracticeParams): EhrEnvAndApiKey<HealthieEnv> {
  const environment = Config.getHealthieEnv();
  if (!environment) throw new MetriportError("Healthie environment not set");
  if (!isHealthieEnv(environment)) {
    throw new MetriportError("Invalid Healthie environment", undefined, { environment });
  }
  const apiKeyMap = getApiKeyMap();
  const key = `${cxId}_${practiceId}_apiKey`;
  const keyEntry = apiKeyMap[key];
  if (!keyEntry) throw new MetriportError("Healthie credentials not found");
  return {
    environment,
    apiKey: keyEntry,
  };
}

export function getApiKeyMap() {
  const rawApiKeyMap = Config.getHealthieApiKeyMap();
  if (!rawApiKeyMap) throw new MetriportError("Healthie secrets map not set");
  const apiKeyMap = cxApiKeyMapSecretSchema.safeParse(JSON.parse(rawApiKeyMap));
  if (!apiKeyMap.success) throw new MetriportError("Healthie api key map has invalid format");
  return apiKeyMap.data;
}
