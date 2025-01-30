import AthenaHealthApi, { AthenaEnv } from "@metriport/core/external/athenahealth/index";
import ElationApi, { ElationEnv } from "@metriport/core/external/elation/index";
import { JwtTokenInfo, MetriportError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import { Duration } from "dayjs/plugin/duration";
import {
  findOrCreateJwtToken,
  getLatestExpiringJwtTokenBySourceAndData,
} from "../../command/jwt-token";
import { athenaClientJwtTokenSource } from "./athenahealth/shared";
import { elationClientJwtTokenSource } from "./elation/shared";
export const delayBetweenPracticeBatches = dayjs.duration(30, "seconds");
export const parallelPractices = 10;
export const parallelPatients = 2;

type EhrEnv = AthenaEnv | ElationEnv;
export type EhrEnvAndClientCredentials<Env extends EhrEnv> = {
  environment: Env;
  clientKey: string;
  clientSecret: string;
};

type EhrClient = AthenaHealthApi | ElationApi;
export type EhrClientParams<Env extends EhrEnv> = {
  twoLeggedAuthTokenInfo: JwtTokenInfo | undefined;
  practiceId: string;
} & EhrEnvAndClientCredentials<Env>;

type EhrClientJwtTokenSource =
  | typeof athenaClientJwtTokenSource
  | typeof elationClientJwtTokenSource;

export enum EhrSources {
  athena = "athenahealth",
  elation = "elation",
}

export type Appointment = {
  cxId: string;
  practiceId: string;
  patientId: string;
};

export function getLookBackTimeRange({ lookBack }: { lookBack: Duration }): {
  startRange: Date;
  endRange: Date;
} {
  const currentDatetime = buildDayjs(new Date());
  const startRange = buildDayjs(currentDatetime).subtract(lookBack).toDate();
  const endRange = buildDayjs(currentDatetime).toDate();
  return {
    startRange,
    endRange,
  };
}

export function getLookForwardTimeRange({ lookForward }: { lookForward: Duration }): {
  startRange: Date;
  endRange: Date;
} {
  const currentDatetime = buildDayjs(new Date());
  const startRange = buildDayjs(currentDatetime).toDate();
  const endRange = buildDayjs(currentDatetime).add(lookForward).toDate();
  return {
    startRange,
    endRange,
  };
}

/**
 * Expiration checks are handled by the clients themselves.
 */
async function getLatestClientJwtTokenInfo({
  cxId,
  practiceId,
  source,
}: {
  cxId: string;
  practiceId: string;
  source: EhrClientJwtTokenSource;
}): Promise<JwtTokenInfo | undefined> {
  const data = { cxId, practiceId, source };
  const token = await getLatestExpiringJwtTokenBySourceAndData({ source, data });
  if (!token) return undefined;
  return {
    access_token: token.token,
    exp: token.exp,
  };
}

export async function createEhrClient<EnvArgs, Env extends EhrEnv, Client extends EhrClient>({
  cxId,
  practiceId,
  source,
  getEnv,
  getEnvParams,
  getClient,
}: {
  cxId: string;
  practiceId: string;
  source: EhrClientJwtTokenSource;
  getEnv: (params: EnvArgs) => EhrEnvAndClientCredentials<Env>;
  getEnvParams: EnvArgs;
  getClient: (params: EhrClientParams<Env>) => Promise<Client>;
}): Promise<Client> {
  const [environment, twoLeggedAuthTokenInfo] = await Promise.all([
    getEnv(getEnvParams),
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
  await findOrCreateJwtToken({
    token: newAuthInfo.access_token,
    exp: newAuthInfo.exp,
    source,
    data,
  });
  return client;
}
