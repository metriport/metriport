import { BadRequestError } from "@metriport/shared";
import {
  AthenaClientJwtTokenData,
  athenaClientSource,
  AthenaDashJwtTokenData,
  athenaDashJwtTokenDataSchema,
  athenaDashSource,
} from "@metriport/shared/interface/external/ehr/athenahealth/jwt-token";
import {
  CanvasClientJwtTokenData,
  canvasClientSource,
  CanvasDashJwtTokenData,
  canvasDashJwtTokenDataSchema,
  canvasDashSource,
  CanvasWebhookJwtTokenData,
  canvasWebhookJwtTokenDataSchema,
  canvasWebhookSource,
} from "@metriport/shared/interface/external/ehr/canvas/jwt-token";
import {
  EClinicalWorksDashJwtTokenData,
  eclinicalworksDashJwtTokenDataSchema,
  eclinicalworksDashSource,
} from "@metriport/shared/interface/external/ehr/eclinicalworks/jwt-token";
import {
  ElationClientJwtTokenData,
  elationClientSource,
  ElationDashJwtTokenData,
  elationDashJwtTokenDataSchema,
  elationDashSource,
} from "@metriport/shared/interface/external/ehr/elation/jwt-token";
import {
  HealthieDashJwtTokenData,
  healthieDashJwtTokenDataSchema,
  healthieDashSource,
} from "@metriport/shared/interface/external/ehr/healthie/jwt-token";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import {
  TouchworksDashJwtTokenData,
  touchworksDashJwtTokenDataSchema,
  touchworksDashSource,
} from "@metriport/shared/interface/external/ehr/touchworks/jwt-token";
import z from "zod";
import { findOrCreateJwtToken, getJwtToken } from "../../../../command/jwt-token";
import { JwtTokenData, JwtTokenSource } from "../../../../domain/jwt-token";

export const ehrDashJwtTokenSources = [
  athenaDashSource,
  canvasDashSource,
  elationDashSource,
  healthieDashSource,
  eclinicalworksDashSource,
  touchworksDashSource,
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
  | EClinicalWorksDashJwtTokenData
  | TouchworksDashJwtTokenData;

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

export const ehrWebhookJwtTokenSources = [canvasWebhookSource] as const;
export type EhrWebhookJwtTokenSource = (typeof ehrWebhookJwtTokenSources)[number];
export function isEhrWebhookJwtTokenSource(source: string): source is EhrWebhookJwtTokenSource {
  return ehrWebhookJwtTokenSources.includes(source as EhrWebhookJwtTokenSource);
}

export type EhrWebhookJwtTokenData = CanvasWebhookJwtTokenData;

export async function checkJwtToken({
  token,
  source,
}: {
  token: string;
  source: JwtTokenSource;
}): Promise<{ active: boolean; expired?: boolean }> {
  const authInfo = await getJwtToken({
    token,
    source,
  });
  if (!authInfo) return { active: false };
  if (authInfo.exp < new Date()) return { active: false, expired: true };
  return { active: true };
}

export async function saveJwtToken({
  token,
  source,
  exp,
  data,
}: {
  token: string;
  source: JwtTokenSource;
  exp: number;
  data: JwtTokenData;
}): Promise<void> {
  await findOrCreateJwtToken({
    token,
    exp: new Date(exp),
    source,
    data,
  });
}

type DashSourceAndSchema = [EhrDashJwtTokenSource, z.ZodSchema<JwtTokenData>];

type DashJwtTokenDataSchemaMap = Record<EhrSource, DashSourceAndSchema>;

const dashJwtTokenDataSchemaBy: DashJwtTokenDataSchemaMap = {
  [EhrSources.canvas]: [canvasDashSource, canvasDashJwtTokenDataSchema],
  [EhrSources.athena]: [athenaDashSource, athenaDashJwtTokenDataSchema],
  [EhrSources.elation]: [elationDashSource, elationDashJwtTokenDataSchema],
  [EhrSources.healthie]: [healthieDashSource, healthieDashJwtTokenDataSchema],
  [EhrSources.eclinicalworks]: [eclinicalworksDashSource, eclinicalworksDashJwtTokenDataSchema],
  [EhrSources.touchworks]: [touchworksDashSource, touchworksDashJwtTokenDataSchema],
};

export function getDashJwtTokenDataSchema(ehr: EhrSources): DashSourceAndSchema {
  const handler = dashJwtTokenDataSchemaBy[ehr];
  if (!handler) {
    throw new BadRequestError("No dash jwt token data handler found", undefined, { ehr });
  }
  return handler;
}

type WebhookSourceAndSchema = [EhrWebhookJwtTokenSource, z.ZodSchema<JwtTokenData>];

type WebhookJwtTokenDataSchemaMap = Record<EhrSource, WebhookSourceAndSchema | undefined>;

const webhookJwtTokenDataSchemaBy: WebhookJwtTokenDataSchemaMap = {
  [EhrSources.canvas]: [canvasWebhookSource, canvasWebhookJwtTokenDataSchema],
  [EhrSources.athena]: undefined,
  [EhrSources.elation]: undefined,
  [EhrSources.healthie]: undefined,
  [EhrSources.eclinicalworks]: undefined,
  [EhrSources.touchworks]: undefined,
};

export function getWebhookJwtTokenDataSchema(ehr: EhrSources): WebhookSourceAndSchema {
  const handler = webhookJwtTokenDataSchemaBy[ehr];
  if (!handler) {
    throw new BadRequestError("No webhook jwt token data handler found", undefined, { ehr });
  }
  return handler;
}
