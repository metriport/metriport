import AthenaHealthApi, { AthenaEnv } from "@metriport/core/external/ehr/athenahealth";
import CanvasApi, { CanvasEnv } from "@metriport/core/external/ehr/canvas/index";
import ElationApi, { ElationEnv } from "@metriport/core/external/ehr/elation";
import { JwtTokenInfo, MetriportError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import {
  athenaSecondaryMappingsSchema,
  AthenaSecondaryMappings,
} from "@metriport/shared/interface/external/ehr/athenahealth/cx-mapping";
import {
  AthenaClientJwtTokenData,
  athenaClientSource,
  AthenaDashJwtTokenData,
  athenaDashSource,
} from "@metriport/shared/src/interface/external/ehr/athenahealth/jwt-token";
import {
  CanvasClientJwtTokenData,
  canvasClientSource,
  CanvasDashJwtTokenData,
  canvasDashSource,
  CanvasWebhookJwtTokenData,
  canvasWebhookSource,
} from "@metriport/shared/src/interface/external/ehr/canvas/jwt-token";
import {
  ElationClientJwtTokenData,
  elationClientSource,
  ElationWebhookJwtTokenData,
  elationWebhookSource,
} from "@metriport/shared/src/interface/external/ehr/elation/jwt-token";
import { EhrSource, EhrSources } from "@metriport/shared/src/interface/external/ehr/source";
import dayjs from "dayjs";
import { Duration } from "dayjs/plugin/duration";
import { z } from "zod";
import {
  findOrCreateJwtToken,
  getLatestExpiringJwtTokenBySourceAndData,
} from "../../command/jwt-token";
export const delayBetweenPracticeBatches = dayjs.duration(30, "seconds");
export const delayBetweenPatientBatches = dayjs.duration(1, "seconds");
export const parallelPractices = 10;
export const parallelPatients = 200;

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

export const ehrDashJwtTokenSources = [athenaDashSource, canvasDashSource] as const;
export type EhrDashJwtTokenSource = (typeof ehrDashJwtTokenSources)[number];
export function isEhrDashJwtTokenSource(source: string): source is EhrDashJwtTokenSource {
  return ehrDashJwtTokenSources.includes(source as EhrDashJwtTokenSource);
}

export type EhrDashJwtTokenData = AthenaDashJwtTokenData | CanvasDashJwtTokenData;

export const ehrClientJwtTokenSources = [
  athenaClientSource,
  elationClientSource,
  canvasClientSource,
] as const;
export type EhrClientJwtTokenSource = (typeof ehrClientJwtTokenSources)[number];
export function isEhrClientJwtTokenSource(source: string): source is EhrClientJwtTokenSource {
  return ehrClientJwtTokenSources.includes(source as EhrClientJwtTokenSource);
}

export type EhrClientJwtTokenData =
  | AthenaClientJwtTokenData
  | ElationClientJwtTokenData
  | CanvasClientJwtTokenData;

export const ehrWebhookJwtTokenSources = [canvasWebhookSource, elationWebhookSource] as const;
export type EhrWebhookJwtTokenSource = (typeof ehrWebhookJwtTokenSources)[number];
export function isEhrWebhookJwtTokenSource(source: string): source is EhrWebhookJwtTokenSource {
  return ehrWebhookJwtTokenSources.includes(source as EhrWebhookJwtTokenSource);
}

export type EhrWebhookJwtTokenData = CanvasWebhookJwtTokenData | ElationWebhookJwtTokenData;

export type EhrCxMappingSecondaryMappings = AthenaSecondaryMappings;
export const ehrCxMappingSecondaryMappingsSchemaMap: {
  [key in EhrSource]: z.Schema | undefined;
} = {
  [EhrSources.athena]: athenaSecondaryMappingsSchema,
  [EhrSources.elation]: undefined,
  [EhrSources.canvas]: undefined,
};

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
