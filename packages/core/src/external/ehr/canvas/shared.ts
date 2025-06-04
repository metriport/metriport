import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import CanvasApi from ".";
import { getSecrets } from "../api/get-client-key-and-secret";
import { getTokenInfo } from "../api/get-token-info";
import { getSecretsOauthSchema } from "../secrets";

export async function createCanvasClient({
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
    ehr: EhrSources.canvas,
    schema: getSecretsOauthSchema,
  });
  const twoLeggedAuthTokenInfo = tokenId ? await getTokenInfo(tokenId) : undefined;
  return await CanvasApi.create({
    twoLeggedAuthTokenInfo,
    practiceId,
    environment: secrets.environment,
    clientKey: secrets.clientKey,
    clientSecret: secrets.clientSecret,
  });
}
