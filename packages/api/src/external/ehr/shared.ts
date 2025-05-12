import AthenaHealthApi, { AthenaEnv } from "@metriport/core/external/ehr/athenahealth/index";
import EclinicalworksApi, {
  EclinicalworksEnv,
} from "@metriport/core/external/ehr/eclinicalworks/index";
import CanvasApi, { CanvasEnv } from "@metriport/core/external/ehr/canvas/index";
import ElationApi, { ElationEnv } from "@metriport/core/external/ehr/elation/index";
import { JwtTokenInfo, MetriportError, BadRequestError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import {
  AthenaSecondaryMappings,
  athenaSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/ehr/athenahealth/cx-mapping";
// no mappings for eclinicalworks

import {
  AthenaClientJwtTokenData,
  athenaClientSource,
  AthenaDashJwtTokenData,
  athenaDashSource,
} from "@metriport/shared/interface/external/ehr/athenahealth/jwt-token";

import {
  EclinicalworksClientJwtTokenData,
  eclinicalworksClientSource,
  EclinicalworksDashJwtTokenData,
  eclinicalworksDashSource,
} from "@metriport/shared/interface/external/ehr/eclinicalworks/jwt-token";

import {
  CanvasClientJwtTokenData,
  canvasClientSource,
  CanvasDashJwtTokenData,
  canvasDashSource,
  CanvasWebhookJwtTokenData,
  canvasWebhookSource,
} from "@metriport/shared/interface/external/ehr/canvas/jwt-token";
import {
  ElationSecondaryMappings,
  elationSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/ehr/elation/cx-mapping";
import {
  ElationClientJwtTokenData,
  elationClientSource,
  ElationDashJwtTokenData,
  elationDashSource,
} from "@metriport/shared/interface/external/ehr/elation/jwt-token";
import {
  HealthieSecondaryMappings,
  healthieSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/ehr/healthie/cx-mapping";
import {
  HealthieDashJwtTokenData,
  healthieDashSource,
} from "@metriport/shared/interface/external/ehr/healthie/jwt-token";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import dayjs from "dayjs";
import { Duration } from "dayjs/plugin/duration";
import { z } from "zod";
import {
  findOrCreateJwtToken,
  getLatestExpiringJwtTokenBySourceAndData,
} from "../../command/jwt-token";

export const delayBetweenPracticeBatches = dayjs.duration(15, "seconds");
export const delayBetweenPatientBatches = dayjs.duration(1, "seconds");
export const parallelPractices = 10;
export const parallelPatients = 200;

type EhrEnv = AthenaEnv | ElationEnv | CanvasEnv | EclinicalworksEnv;
export type EhrEnvAndClientCredentials<Env extends EhrEnv> = {
  environment: Env;
  clientKey: string;
  clientSecret: string;
};

export type EhrEnvAndApiKey<Env extends EhrEnv> = {
  environment: Env;
  apiKey: string;
};

export interface IEhrClient {
  getTwoLeggedAuthTokenInfo(): JwtTokenInfo;
}

type EhrClient = AthenaHealthApi | ElationApi | CanvasApi | EclinicalworksApi;
export type EhrClientParams<Env extends EhrEnv> = {
  twoLeggedAuthTokenInfo: JwtTokenInfo | undefined;
  practiceId: string;
} & EhrEnvAndClientCredentials<Env>;

export const ehrDashJwtTokenSources = [
  athenaDashSource,
  canvasDashSource,
  elationDashSource,
  healthieDashSource,
  eclinicalworksDashSource,
] as const;
export type EhrDashJwtTokenSource = (typeof ehrDashJwtTokenSources)[number];
export function isEhrDashJwtTokenSource(source: string): source is EhrDashJwtTokenSource {
  return ehrDashJwtTokenSources.includes(source as EhrDashJwtTokenSource);
}

export type EhrDashJwtTokenData =
  | AthenaDashJwtTokenData
  | CanvasDashJwtTokenData
  | ElationDashJwtTokenData
  | HealthieDashJwtTokenData
  | EclinicalworksDashJwtTokenData;

export const ehrClientJwtTokenSources = [
  athenaClientSource,
  elationClientSource,
  canvasClientSource,
  eclinicalworksClientSource,
] as const;
export type EhrClientJwtTokenSource = (typeof ehrClientJwtTokenSources)[number];
export function isEhrClientJwtTokenSource(source: string): source is EhrClientJwtTokenSource {
  return ehrClientJwtTokenSources.includes(source as EhrClientJwtTokenSource);
}

export type EhrClientJwtTokenData =
  | AthenaClientJwtTokenData
  | ElationClientJwtTokenData
  | CanvasClientJwtTokenData
  | EclinicalworksClientJwtTokenData;

export const ehrWebhookJwtTokenSources = [canvasWebhookSource] as const;
export type EhrWebhookJwtTokenSource = (typeof ehrWebhookJwtTokenSources)[number];
export function isEhrWebhookJwtTokenSource(source: string): source is EhrWebhookJwtTokenSource {
  return ehrWebhookJwtTokenSources.includes(source as EhrWebhookJwtTokenSource);
}

export type EhrWebhookJwtTokenData = CanvasWebhookJwtTokenData;

// @todo: webhook stuff
export type EhrCxMappingSecondaryMappings =
  | AthenaSecondaryMappings
  | ElationSecondaryMappings
  | HealthieSecondaryMappings;
export const ehrCxMappingSecondaryMappingsSchemaMap: {
  [key in EhrSource]: z.Schema | undefined;
} = {
  [EhrSources.athena]: athenaSecondaryMappingsSchema,
  [EhrSources.elation]: elationSecondaryMappingsSchema,
  [EhrSources.canvas]: undefined,
  [EhrSources.healthie]: healthieSecondaryMappingsSchema,
  [EhrSources.eclinicalworks]: undefined,
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
  const currentDatetime = buildDayjs();
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
  const currentDatetime = buildDayjs();
  const startRange = buildDayjs(currentDatetime).toDate();
  const endRange = buildDayjs(currentDatetime).add(lookForward).toDate();
  return {
    startRange,
    endRange,
  };
}

export function getLookForwardTimeRangeWithOffset({
  lookForward,
  offset,
}: {
  lookForward: Duration;
  offset: Duration;
}): {
  startRange: Date;
  endRange: Date;
} {
  const currentDatetime = buildDayjs();
  const startRange = buildDayjs(currentDatetime).add(offset).toDate();
  const endRange = buildDayjs(currentDatetime).add(lookForward).toDate();
  if (startRange > endRange) throw new BadRequestError("Start range is greater than end range");
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
  const data = { cxId, practiceId, source } as EhrClientJwtTokenData;
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

export async function createEhrClient<Env extends EhrEnv, Client extends EhrClient>({
  cxId,
  practiceId,
  source,
  getEnv,
  getClient,
}: EhrPerPracticeParams & {
  source: EhrClientJwtTokenSource;
  getEnv: GetEnvParams<Env, EnvArgs>; //any would work but linter not happy
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
  // Use type assertion to let TypeScript know this client has the getTwoLeggedAuthTokenInfo method
  const newAuthInfo = (client as IEhrClient).getTwoLeggedAuthTokenInfo();
  if (!newAuthInfo) throw new MetriportError("Client not created with two-legged auth token");

  if (!isEhrClientJwtTokenSource(source)) {
    throw new BadRequestError(`Unsupported EHR source: ${source}`);
  }

  const data = { cxId, practiceId, source } as EhrClientJwtTokenData;
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
