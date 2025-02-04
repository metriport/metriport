import AthenaHealthApi, {
  AthenaEnv,
  isAthenaEnv,
} from "@metriport/core/external/athenahealth/index";
import { MetriportError } from "@metriport/shared";
import { Config } from "../../../shared/config";
import { createEhrClient, EhrClienUniqueClientParams, EhrEnvAndClientCredentials } from "../shared";

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
  unqiueParams: EhrClienUniqueClientParams
): Promise<AthenaHealthApi> {
  return await createEhrClient<undefined, AthenaEnv, AthenaHealthApi>({
    ...unqiueParams,
    source: athenaClientJwtTokenSource,
    getEnv: getAthenaEnv,
    getEnvParams: undefined,
    getClient: AthenaHealthApi.create,
  });
}
