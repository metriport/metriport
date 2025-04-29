import HealthieApi, {
  HealthieEnv,
  isHealthieEnv,
} from "@metriport/core/external/ehr/healthie/index";
import { cxApiKeyMapSecretSchema, MetriportError, NotFoundError } from "@metriport/shared";
import { healthieSecondaryMappingsSchema } from "@metriport/shared/interface/external/ehr/healthie/cx-mapping";
import { SubscriptionResource } from "@metriport/shared/interface/external/ehr/healthie/subscription";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import dayjs from "dayjs";
import { getCxMappingOrFail } from "../../../command/mapping/cx";
import { Config } from "../../../shared/config";
import { EhrEnvAndApiKey, EhrPerPracticeParams } from "../shared";

export const healthieWebhookCreatedDateDiffSeconds = dayjs.duration(5, "seconds");

function getHealthieEnv({ cxId, practiceId }: EhrPerPracticeParams): EhrEnvAndApiKey<HealthieEnv> {
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

export async function createHealthieClient(
  perPracticeParams: EhrPerPracticeParams
): Promise<HealthieApi> {
  const { environment, apiKey } = getHealthieEnv(perPracticeParams);
  return await HealthieApi.create({
    practiceId: perPracticeParams.practiceId,
    environment,
    apiKey,
  });
}

export async function getHealthieSecretKeyInfo(
  practiceId: string,
  resource: SubscriptionResource
): Promise<{
  cxId: string;
  practiceId: string;
  secretKey: string;
}> {
  const cxMapping = await getCxMappingOrFail({
    externalId: practiceId,
    source: EhrSources.healthie,
  });
  if (!cxMapping.secondaryMappings) {
    throw new MetriportError("Healthie secondary mappings not found", undefined, {
      externalId: practiceId,
      source: EhrSources.healthie,
    });
  }
  const secondaryMappings = healthieSecondaryMappingsSchema.parse(cxMapping.secondaryMappings);
  const secretKey = secondaryMappings.webhooks?.[resource]?.secretKey;
  if (!secretKey) {
    throw new NotFoundError("Healthie secret key not found", {
      externalId: practiceId,
      source: EhrSources.healthie,
    });
  }
  return { cxId: cxMapping.cxId, practiceId, secretKey };
}

function getApiKeyMap() {
  const rawApiKeyMap = Config.getHealthieApiKeyMap();
  if (!rawApiKeyMap) throw new MetriportError("Healthie secrets map not set");
  const apiKeyMap = cxApiKeyMapSecretSchema.safeParse(JSON.parse(rawApiKeyMap));
  if (!apiKeyMap.success) throw new MetriportError("Healthie api key map has invalid format");
  return apiKeyMap.data;
}

export enum LookupModes {
  Appointments = "appointments",
  Appointments48hr = "appointments-48hr",
}
export const lookupModes = [...Object.values(LookupModes)] as const;
export type LookupMode = (typeof lookupModes)[number];
export function isLookupMode(value: string): value is LookupMode {
  return lookupModes.includes(value as LookupMode);
}
