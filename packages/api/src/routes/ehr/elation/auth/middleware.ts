import { buildDayjs } from "@metriport/shared/common/date";
import {
  elationDashSource,
  elationWebhookSource,
} from "@metriport/shared/interface/external/ehr/elation/jwt-token";
import { NextFunction, Request, Response } from "express";
import { getJwtToken, updateTokenExpiration } from "../../../../command/jwt-token";
import { JwtTokenData } from "../../../../domain/jwt-token";
import ForbiddenError from "../../../../errors/forbidden";
import { getAuthorizationToken } from "../../../util";
import {
  ParseResponse,
  processCxIdAsync,
  processDocumentRouteAsync,
  processPatientRouteAsync,
} from "../../shared";
import dayjs from "dayjs";

export const elationTokenExpirationDuration = dayjs.duration(30, "minutes");

export const tokenEhrPatientIdQueryParam = "elationPatientIdFromToken";

function parseElationPracticeIdDash(tokenData: JwtTokenData): ParseResponse {
  if (tokenData.source !== elationDashSource) throw new ForbiddenError();
  const practiceId = tokenData.practiceId;
  if (!practiceId) throw new ForbiddenError();
  const patientId = tokenData.patientId;
  if (!patientId) throw new ForbiddenError();
  return {
    externalId: practiceId,
    queryParams: {
      practiceId,
      [tokenEhrPatientIdQueryParam]: patientId,
    },
  };
}

function parseElationPracticeIdWebhook(tokenData: JwtTokenData): ParseResponse {
  if (tokenData.source !== elationWebhookSource) throw new ForbiddenError();
  const practiceId = tokenData.practiceId;
  if (!practiceId) throw new ForbiddenError();
  return {
    externalId: practiceId,
    queryParams: {
      practiceId,
    },
  };
}

async function updateTokenExpirationAsync(req: Request): Promise<void> {
  const accessToken = getAuthorizationToken(req);
  const authInfo = await getJwtToken({ token: accessToken, source: elationDashSource });
  if (!authInfo) throw new ForbiddenError();
  const newExpiration = buildDayjs().add(elationTokenExpirationDuration).toDate();
  if (authInfo.exp < newExpiration) return;
  try {
    await updateTokenExpiration({ id: authInfo.id, exp: newExpiration });
  } catch (error) {
    throw new ForbiddenError();
  }
}

export function processCxIdDash(req: Request, res: Response, next: NextFunction) {
  processCxIdAsync(req, elationDashSource, parseElationPracticeIdDash)
    .then(() => updateTokenExpirationAsync(req))
    .then(next)
    .catch(next);
}

export function processCxIdWebhooks(req: Request, res: Response, next: NextFunction) {
  processCxIdAsync(req, elationWebhookSource, parseElationPracticeIdWebhook).then(next).catch(next);
}

export function processPatientRoute(req: Request, res: Response, next: NextFunction) {
  processPatientRouteAsync(req, elationDashSource).then(next).catch(next);
}

export function processDocumentRoute(req: Request, res: Response, next: NextFunction) {
  processDocumentRouteAsync(req, elationDashSource).then(next).catch(next);
}
