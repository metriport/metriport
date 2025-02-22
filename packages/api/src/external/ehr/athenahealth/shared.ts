import AthenaHealthApi, {
  AthenaEnv,
  isAthenaEnv,
} from "@metriport/core/external/athenahealth/index";
import { MetriportError } from "@metriport/shared";
import { Config } from "../../../shared/config";
import { createEhrClient, EhrEnvAndClientCredentials, EhrPerPracticeParams } from "../shared";

export const athenaClientJwtTokenSource = "athenahealth-client";

function getAthenaEnv(): EhrEnvAndClientCredentials<AthenaEnv> {
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

export async function createAthenaClient(
  perPracticeParams: EhrPerPracticeParams
): Promise<AthenaHealthApi> {
  return await createEhrClient<AthenaEnv, AthenaHealthApi>({
    ...perPracticeParams,
    source: athenaClientJwtTokenSource,
    getEnv: { params: undefined, getEnv: getAthenaEnv },
    getClient: AthenaHealthApi.create,
  });
}

export enum LookupMode {
  FromSubscription = "from-subscription",
  FromSubscriptionBackfill = "from-subscription-backfill",
  Appointments = "appointments",
}
export function isLookupMode(value: string): value is LookupMode {
  return Object.values(LookupMode).includes(value as LookupMode);
}
