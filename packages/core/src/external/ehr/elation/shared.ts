import { BadRequestError } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import ElationHealthApi, { isElationEnv } from ".";
import { getTokenInfo } from "../api/get-token-info";
import { getOauthSecrets } from "../shared";

export async function createElationHealthClient({
  environment,
  cxId,
  practiceId,
  tokenId,
}: {
  environment: string;
  cxId: string;
  practiceId: string;
  tokenId: string;
}) {
  if (!isElationEnv(environment)) {
    throw new BadRequestError("Invalid environment", undefined, {
      ehr: EhrSources.elation,
      environment,
    });
  }
  const twoLeggedAuthTokenInfo = await getTokenInfo(tokenId);
  return await ElationHealthApi.create({
    twoLeggedAuthTokenInfo,
    practiceId,
    environment,
    getSecrets: async () => getOauthSecrets({ cxId, practiceId, ehr: EhrSources.elation }),
  });
}
