import {
  AthenaClientJwtTokenData,
  athenaClientSource,
  AthenaDashJwtTokenData,
  athenaDashSource,
} from "@metriport/shared/interface/external/ehr/athenahealth/jwt-token";
import {
  CanvasClientJwtTokenData,
  canvasClientSource,
  CanvasDashJwtTokenData,
  canvasDashSource,
  CanvasWebhookJwtTokenData,
  canvasWebhookSource,
} from "@metriport/shared/interface/external/ehr/canvas/jwt-token";
import {
  ElationClientJwtTokenData,
  elationClientSource,
  ElationDashJwtTokenData,
  elationDashSource,
} from "@metriport/shared/interface/external/ehr/elation/jwt-token";
import {
  HealthieDashJwtTokenData,
  healthieDashSource,
} from "@metriport/shared/interface/external/ehr/healthie/jwt-token";
import { findOrCreateJwtToken, getJwtToken } from "../../../../command/jwt-token";
import { JwtTokenData, JwtTokenSource } from "../../../../domain/jwt-token";

export const ehrDashJwtTokenSources = [
  athenaDashSource,
  canvasDashSource,
  elationDashSource,
  healthieDashSource,
] as const;
export type EhrDashJwtTokenSource = (typeof ehrDashJwtTokenSources)[number];
export function isEhrDashJwtTokenSource(source: string): source is EhrDashJwtTokenSource {
  return ehrDashJwtTokenSources.includes(source as EhrDashJwtTokenSource);
}

export type EhrDashJwtTokenData =
  | AthenaDashJwtTokenData
  | CanvasDashJwtTokenData
  | ElationDashJwtTokenData
  | HealthieDashJwtTokenData;

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
