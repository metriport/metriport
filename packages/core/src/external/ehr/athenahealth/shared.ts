import { BadRequestError } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import AthenaHealthApi, { isAthenaEnv } from ".";
import { getSecrets } from "../api/get-client-key-and-secret";
import { getTokenInfo } from "../api/get-token-info";
import { getSecretsOauthSchema } from "../secrets";

export async function createAthenaHealthClient({
  cxId,
  practiceId,
  tokenId,
}: {
  cxId: string;
  practiceId: string;
  tokenId?: string;
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
  const twoLeggedAuthTokenInfo = tokenId ? await getTokenInfo(tokenId) : undefined;
  return await AthenaHealthApi.create({
    twoLeggedAuthTokenInfo,
    practiceId,
    environment,
    clientKey: secrets.clientKey,
    clientSecret: secrets.clientSecret,
  });
}
