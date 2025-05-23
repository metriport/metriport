import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import CanvasApi from ".";
import { getTokenInfo } from "../api/get-token-info";
import { getOauthSecrets } from "../shared";

export async function createCanvasClient({
  environment,
  cxId,
  practiceId,
  tokenId,
}: {
  environment: string;
  cxId: string;
  practiceId: string;
  tokenId?: string;
}) {
  const twoLeggedAuthTokenInfo = tokenId ? await getTokenInfo(tokenId) : undefined;
  return await CanvasApi.create({
    twoLeggedAuthTokenInfo,
    practiceId,
    environment,
    getSecrets: async () => getOauthSecrets({ cxId, practiceId, ehr: EhrSources.canvas }),
  });
}
