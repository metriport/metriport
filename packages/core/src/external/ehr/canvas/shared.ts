import { JwtTokenInfo } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import CanvasApi from ".";
import { getSecrets } from "../api/get-client-key-and-secret";
import { getSecretsOauthSchema } from "../secrets";

export async function createCanvasClient({
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
    ehr: EhrSources.canvas,
    schema: getSecretsOauthSchema,
  });
  const twoLeggedAuthTokenInfo = tokenInfo ?? undefined;
  return await CanvasApi.create({
    twoLeggedAuthTokenInfo,
    practiceId,
    environment: secrets.environment,
    clientKey: secrets.clientKey,
    clientSecret: secrets.clientSecret,
  });
}
