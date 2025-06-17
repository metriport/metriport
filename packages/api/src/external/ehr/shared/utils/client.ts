import {
  EhrClientWithClientCredentials,
  EhrClientWithClientCredentialsParams,
  EhrEnv,
  EhrEnvAndClientCredentials,
  EhrPerPracticeParams,
} from "@metriport/core/external/ehr/environment";
import { JwtTokenInfo, MetriportError } from "@metriport/shared";
import {
  findOrCreateJwtToken,
  getLatestExpiringJwtTokenBySourceAndData,
} from "../../../../command/jwt-token";
import { EhrClientJwtTokenSource } from "./jwt-token";

/**
 * Expiration checks are handled by the clients themselves.
 */
async function getLatestClientJwtTokenInfo({
  cxId,
  practiceId,
  source,
}: EhrPerPracticeParams & { source: EhrClientJwtTokenSource }): Promise<JwtTokenInfo | undefined> {
  const data = { cxId, practiceId, source };
  const token = await getLatestExpiringJwtTokenBySourceAndData({ source, data });
  if (!token) return undefined;
  return {
    access_token: token.token,
    exp: token.exp,
    id: token.id,
  };
}

export type GetEnvParams<Env extends EhrEnv, EnvArgs> = {
  params: EnvArgs;
  getEnv: (params: EnvArgs) => EhrEnvAndClientCredentials<Env>;
};

export async function createEhrClientWithClientCredentials<
  Env extends EhrEnv,
  Client extends EhrClientWithClientCredentials,
  EnvArgs = undefined
>({
  cxId,
  practiceId,
  source,
  getEnv,
  getClient,
}: EhrPerPracticeParams & {
  source: EhrClientJwtTokenSource;
  getEnv: GetEnvParams<Env, EnvArgs>;
  getClient: (params: EhrClientWithClientCredentialsParams<Env>) => Promise<Client>;
}): Promise<{ client: Client; tokenId: string; environment: Env }> {
  const [environment, twoLeggedAuthTokenInfo] = await Promise.all([
    getEnv.getEnv(getEnv.params),
    getLatestClientJwtTokenInfo({ cxId, practiceId, source }),
  ]);
  const client = await getClient({
    twoLeggedAuthTokenInfo,
    practiceId,
    ...environment,
  });
  const newAuthInfo = client.getTwoLeggedAuthTokenInfo();
  if (!newAuthInfo) throw new MetriportError("Client not created with two-legged auth token");
  const data = { cxId, practiceId, source };
  const token = await findOrCreateJwtToken({
    token: newAuthInfo.access_token,
    exp: newAuthInfo.exp,
    source,
    data,
  });
  return { client, tokenId: token.id, environment: environment.environment };
}
