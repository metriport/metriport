import { BadRequestError, JwtTokenInfo } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import PracticeFusionApi, { isPracticeFusionEnv } from ".";
import { getSecrets } from "../api/get-client-key-and-secret";
import { getRefreshToken } from "../api/get-refresh-token";
import { getSecretsOauthSchema } from "../secrets";

export async function createPracticeFusionClient({
  cxId,
  practiceId,
  tokenInfo,
}: {
  cxId: string;
  practiceId: string;
  tokenInfo?: JwtTokenInfo;
}) {
  const [secrets, refreshTokenResult] = await Promise.all([
    getSecrets({
      cxId,
      practiceId,
      ehr: EhrSources.practicefusion,
      schema: getSecretsOauthSchema,
    }),
    getRefreshToken({
      practiceId,
      ehr: EhrSources.practicefusion,
    }),
  ]);
  const environment = secrets.environment;
  if (!isPracticeFusionEnv(environment)) {
    throw new BadRequestError("Invalid environment", undefined, {
      ehr: EhrSources.practicefusion,
      environment,
    });
  }
  return await PracticeFusionApi.create({
    twoLeggedAuthTokenInfo: tokenInfo,
    practiceId,
    environment,
    clientKey: secrets.clientKey,
    clientSecret: secrets.clientSecret,
    refreshToken: refreshTokenResult.refreshToken,
  });
}
