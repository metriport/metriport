import { MetriportError } from "@metriport/shared";
import { Config } from "../../../util/config";
import { EhrEnvAndClientCredentials } from "../environment";
import { AthenaEnv, isAthenaEnv } from "./index";

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
