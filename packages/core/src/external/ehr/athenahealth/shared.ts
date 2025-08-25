import { BadRequestError, JwtTokenInfo } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import AthenaHealthApi, { isAthenaEnv } from ".";
import { getSecrets } from "../api/get-client-key-and-secret";
import { getSecretsOauthSchema } from "../secrets";

export async function createAthenaHealthClient({
  cxId,
  practiceId,
  tokenInfo,
}: {
  cxId: string;
  practiceId: string;
  tokenInfo?: JwtTokenInfo;
}) {
  const secrets = await getSecrets({
    cxId,
    practiceId,
    ehr: EhrSources.athena,
    schema: getSecretsOauthSchema,
  });
  const environment = secrets.environment;
  if (!isAthenaEnv(environment)) {
    throw new BadRequestError("Invalid environment", undefined, {
      ehr: EhrSources.athena,
      environment,
    });
  }
  const twoLeggedAuthTokenInfo = tokenInfo ?? undefined;
  return await AthenaHealthApi.create({
    twoLeggedAuthTokenInfo,
    practiceId,
    environment,
    clientKey: secrets.clientKey,
    clientSecret: secrets.clientSecret,
  });
}
