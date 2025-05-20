import AthenaHealthApi, {
  AthenaEnv,
  isAthenaEnv,
} from "@metriport/core/external/ehr/athenahealth/index";
import { MetriportError } from "@metriport/shared";
import { Config } from "../../../shared/config";
import {
  createEhrClient,
  EhrEnvAndClientCredentials,
  EhrPerPracticeParams,
} from "../shared/utils/client";

export const athenaClientJwtTokenSource = "athenahealth-client";

export function getAthenaEnv(): EhrEnvAndClientCredentials<AthenaEnv> {
  const environment = Config.getAthenaHealthEnv();
  if (!environment) throw new MetriportError("AthenaHealth environment not set");
  if (!isAthenaEnv(environment)) {
    throw new MetriportError("Invalid AthenaHealth environment", undefined, { environment });
  }
  const clientKey = Config.getAthenaHealthClientKey();
  const clientSecret = Config.getAthenaHealthClientSecret();
  if (!clientKey || !clientSecret) throw new MetriportError("AthenaHealth secrets not set");
  return {
    environment,
    clientKey,
    clientSecret,
  };
}

export async function createAthenaClientWithTokenIdAndEnvironment(
  perPracticeParams: EhrPerPracticeParams
): Promise<{ client: AthenaHealthApi; tokenId: string; environment: AthenaEnv }> {
  return await createEhrClient<AthenaEnv, AthenaHealthApi>({
    ...perPracticeParams,
    source: athenaClientJwtTokenSource,
    getEnv: { params: undefined, getEnv: getAthenaEnv },
    getClient: AthenaHealthApi.create,
  });
}

export async function createAthenaClient(
  perPracticeParams: EhrPerPracticeParams
): Promise<AthenaHealthApi> {
  const { client } = await createAthenaClientWithTokenIdAndEnvironment(perPracticeParams);
  return client;
}

export enum LookupModes {
  FromSubscription = "from-subscription",
  FromSubscriptionBackfill = "from-subscription-backfill",
  Appointments = "appointments",
}
export const lookupModes = [...Object.values(LookupModes)] as const;
export type LookupMode = (typeof lookupModes)[number];
export function isLookupMode(value: string): value is LookupMode {
  return lookupModes.includes(value as LookupMode);
}
