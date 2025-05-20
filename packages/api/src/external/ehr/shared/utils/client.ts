import AthenaHealthApi, { AthenaEnv } from "@metriport/core/external/ehr/athenahealth/index";
import CanvasApi, { CanvasEnv } from "@metriport/core/external/ehr/canvas/index";
import ElationApi, { ElationEnv } from "@metriport/core/external/ehr/elation/index";
import { HealthieEnv } from "@metriport/core/external/ehr/healthie/index";
import { JwtTokenInfo, MetriportError } from "@metriport/shared";
import {
  findOrCreateJwtToken,
  getLatestExpiringJwtTokenBySourceAndData,
} from "../../../../command/jwt-token";
import { EhrClientJwtTokenSource } from "./jwt-token";

export type EhrEnv = AthenaEnv | ElationEnv | CanvasEnv | HealthieEnv;
export type EhrEnvAndClientCredentials<Env extends EhrEnv> = {
  environment: Env;
  clientKey: string;
  clientSecret: string;
};

export type EhrEnvAndApiKey<Env extends EhrEnv> = {
  environment: Env;
  apiKey: string;
};

type EhrOauthClient = AthenaHealthApi | ElationApi | CanvasApi;
export type EhrClientParams<Env extends EhrEnv> = {
  twoLeggedAuthTokenInfo: JwtTokenInfo | undefined;
  practiceId: string;
} & EhrEnvAndClientCredentials<Env>;

export type EhrPerPracticeParams = { cxId: string; practiceId: string };

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

export async function createEhrClient<
  Env extends EhrEnv,
  Client extends EhrOauthClient,
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
  getClient: (params: EhrClientParams<Env>) => Promise<Client>;
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
