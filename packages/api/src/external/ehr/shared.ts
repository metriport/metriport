import AthenaHealthApi, { AthenaEnv } from "@metriport/core/external/athenahealth/index";
import CanvasApi, { CanvasEnv } from "@metriport/core/external/canvas/index";
import ElationApi, { ElationEnv } from "@metriport/core/external/elation/index";
import { JwtTokenInfo, MetriportError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import {
  AthenaClientJwtTokenData,
  AthenaJwtTokenData,
} from "@metriport/shared/src/interface/external/athenahealth/jwt-token";
import {
  CanvasClientJwtTokenData,
  CanvasJwtTokenData,
  CanvasWebhookJwtTokenData,
} from "@metriport/shared/src/interface/external/canvas/jwt-token";
import {
  ElationClientJwtTokenData,
  ElationWebhookJwtTokenData,
} from "@metriport/shared/src/interface/external/elation/jwt-token";
import dayjs from "dayjs";
import { Duration } from "dayjs/plugin/duration";
import {
  findOrCreateJwtToken,
  getLatestExpiringJwtTokenBySourceAndData,
} from "../../command/jwt-token";
import { athenaClientJwtTokenSource } from "./athenahealth/shared";
import { canvasClientJwtTokenSource, canvasWebhookJwtTokenSource } from "./canvas/shared";
import { elationClientJwtTokenSource, elationWebhookJwtTokenSource } from "./elation/shared";

export const delayBetweenPracticeBatches = dayjs.duration(30, "seconds");
export const parallelPractices = 10;
export const parallelPatients = 2;

type EhrEnv = AthenaEnv | ElationEnv | CanvasEnv;
export type EhrEnvAndClientCredentials<Env extends EhrEnv> = {
  environment: Env;
  clientKey: string;
  clientSecret: string;
};

type EhrClient = AthenaHealthApi | ElationApi | CanvasApi;
export type EhrClientParams<Env extends EhrEnv> = {
  twoLeggedAuthTokenInfo: JwtTokenInfo | undefined;
  practiceId: string;
} & EhrEnvAndClientCredentials<Env>;

export enum EhrSources {
  athena = "athenahealth",
  elation = "elation",
  canvas = "canvas",
}
export const ehrSources = [...Object.values(EhrSources)] as const;
export type EhrSource = (typeof ehrSources)[number];
export function isEhrSource(source: string): source is EhrSource {
  return ehrSources.includes(source as EhrSource);
}

export const ehrDashJwtTokenSources = [EhrSources.athena, EhrSources.canvas] as const;
export type EhrDashJwtTokenSource = (typeof ehrDashJwtTokenSources)[number];
export function isEhrDashJwtTokenSource(source: string): source is EhrDashJwtTokenSource {
  return ehrDashJwtTokenSources.includes(source as EhrDashJwtTokenSource);
}

export type EhrDashJwtTokenData = AthenaJwtTokenData | CanvasJwtTokenData;

export const ehrClientJwtTokenSources = [
  athenaClientJwtTokenSource,
  elationClientJwtTokenSource,
  canvasClientJwtTokenSource,
] as const;
export type EhrClientJwtTokenSource = (typeof ehrClientJwtTokenSources)[number];
export function isEhrClientJwtTokenSource(source: string): source is EhrClientJwtTokenSource {
  return ehrClientJwtTokenSources.includes(source as EhrClientJwtTokenSource);
}

export type EhrClientJwtTokenData =
  | AthenaClientJwtTokenData
  | ElationClientJwtTokenData
  | CanvasClientJwtTokenData;

export const ehrWebhookJwtTokenSources = [
  canvasWebhookJwtTokenSource,
  elationWebhookJwtTokenSource,
] as const;
export type EhrWebhookJwtTokenSource = (typeof ehrWebhookJwtTokenSources)[number];
export function isEhrWebhookJwtTokenSource(source: string): source is EhrWebhookJwtTokenSource {
  return ehrWebhookJwtTokenSources.includes(source as EhrWebhookJwtTokenSource);
}

export type EhrWebhookJwtTokenData = CanvasWebhookJwtTokenData | ElationWebhookJwtTokenData;

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
  };
}

export type GetEnvParams<Env extends EhrEnv, EnvArgs> = {
  params: EnvArgs;
  getEnv: (params: EnvArgs) => EhrEnvAndClientCredentials<Env>;
};

export async function createEhrClient<
  Env extends EhrEnv,
  Client extends EhrClient,
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
}): Promise<Client> {
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
  await findOrCreateJwtToken({
    token: newAuthInfo.access_token,
    exp: newAuthInfo.exp,
    source,
    data,
  });
  return client;
}

export function parseExternalId(source: string, externalId: string): string {
  if (source === EhrSources.athena) {
    const patientId = externalId.split("-")[2];
    if (!patientId) {
      throw new MetriportError("AthenaHealth patient mapping externalId is malformed", undefined, {
        externalId,
      });
    }
    return patientId;
  }
  return externalId;
}
