import { BadRequestError } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import ElationHealthApi, { isElationEnv } from ".";
import { getSecrets } from "../api/get-client-key-and-secret";
import { getTokenInfo } from "../api/get-token-info";
import { getSecretsOauthSchema } from "../secrets";

export async function createElationHealthClient({
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
    ehr: EhrSources.elation,
    schema: getSecretsOauthSchema,
  });
  const environment = secrets.environment;
  if (!isElationEnv(environment)) {
    throw new BadRequestError("Invalid environment", undefined, {
      ehr: EhrSources.elation,
      environment,
    });
  }
  const twoLeggedAuthTokenInfo = tokenId ? await getTokenInfo(tokenId) : undefined;
  return await ElationHealthApi.create({
    twoLeggedAuthTokenInfo,
    practiceId,
    environment,
    clientKey: secrets.clientKey,
    clientSecret: secrets.clientSecret,
  });
}
