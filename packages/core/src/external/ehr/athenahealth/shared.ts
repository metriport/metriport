import { BadRequestError } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import AthenaHealthApi, { isAthenaEnv } from ".";
import { getTokenInfo } from "../api/get-token-info";
import { getOauthSecrets } from "../shared";

export async function createAthenaHealthClient({
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
  if (!isAthenaEnv(environment)) {
    throw new BadRequestError("Invalid environment", undefined, {
      ehr: EhrSources.athena,
      environment,
    });
  }
  const twoLeggedAuthTokenInfo = await getTokenInfo(tokenId);
  return await AthenaHealthApi.create({
    twoLeggedAuthTokenInfo,
    practiceId,
    environment,
    getSecrets: async () => getOauthSecrets({ cxId, practiceId, ehr: EhrSources.athena }),
  });
}
