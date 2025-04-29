import { verifySignature } from "@metriport/core/util/webhook";
import { buildDayjs } from "@metriport/shared/common/date";
import { healthieDashSource } from "@metriport/shared/interface/external/ehr/healthie/jwt-token";
import { isSubscriptionResource } from "@metriport/shared/interface/external/ehr/healthie/subscription";
import { NextFunction, Request, Response } from "express";
import { getJwtToken, updateTokenExpiration } from "../../../../command/jwt-token";
import { JwtTokenData } from "../../../../domain/jwt-token";
import ForbiddenError from "../../../../errors/forbidden";
import { shortDurationTokenDuration } from "../../../../external/ehr/healthie/command/sync-patient";
import { getHealthieSecretKeyInfo } from "../../../../external/ehr/healthie/shared";
import { getAuthorizationToken } from "../../../util";
import {
  ParseResponse,
  processCxId as processCxIdShared,
  processDocumentRoute as processDocumentRouteShared,
  processPatientRoute as processPatientRouteShared,
} from "../../shared";

export const tokenEhrPatientIdQueryParam = "healthiePatientIdFromToken";

async function processCxIdWebhook(req: Request): Promise<void> {
  const eventType = req.body.event_type;
  if (!eventType) throw new ForbiddenError();
  if (!isSubscriptionResource(eventType)) throw new ForbiddenError();
  const practiceId = req.path.split("/")[-1];
  if (!practiceId) throw new ForbiddenError();
  try {
    const secretKeyInfo = await getHealthieSecretKeyInfo(practiceId, eventType);
    const verified = await verifySignature({
      method: req.method,
      path: req.path,
      query: req.query.toString(),
      headers: req.headers as Record<string, string>,
      body: req.body,
      secretKey: secretKeyInfo.secretKey,
    });
    if (verified) {
      req.cxId = secretKeyInfo.cxId;
      req.query = {
        ...req.query,
        practiceId: secretKeyInfo.practiceId,
      };
      return;
    }
  } catch (error) {
    throw new ForbiddenError();
  }
  throw new ForbiddenError();
}

function parseHealthiePracticeIdDash(tokenData: JwtTokenData): ParseResponse {
  if (tokenData.source !== healthieDashSource) throw new ForbiddenError();
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

async function shortenLongDurationToken(req: Request): Promise<void> {
  const accessToken = getAuthorizationToken(req);
  const authInfo = await getJwtToken({ token: accessToken, source: healthieDashSource });
  if (!authInfo) throw new ForbiddenError();
  const newExpiration = buildDayjs().add(shortDurationTokenDuration).toDate();
  if (authInfo.exp <= newExpiration) return;
  try {
    await updateTokenExpiration({ id: authInfo.id, exp: newExpiration });
  } catch (error) {
    throw new ForbiddenError();
  }
}

export function processCxIdDash(req: Request, res: Response, next: NextFunction) {
  processCxIdShared(req, healthieDashSource, parseHealthiePracticeIdDash)
    .then(() => shortenLongDurationToken(req))
    .then(next)
    .catch(next);
}

export function processCxIdWebhooks(req: Request, res: Response, next: NextFunction) {
  processCxIdWebhook(req).then(next).catch(next);
}

export function processPatientRoute(req: Request, res: Response, next: NextFunction) {
  processPatientRouteShared(req, healthieDashSource).then(next).catch(next);
}

export function processDocumentRoute(req: Request, res: Response, next: NextFunction) {
  processDocumentRouteShared(req, healthieDashSource).then(next).catch(next);
}
