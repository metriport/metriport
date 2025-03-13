import {
  elationDashSource,
  elationWebhookSource,
} from "@metriport/shared/interface/external/ehr/elation/jwt-token";
import { NextFunction, Request, Response } from "express";
import { JwtTokenData } from "../../../../domain/jwt-token";
import ForbiddenError from "../../../../errors/forbidden";
import {
  ParseResponse,
  processCxIdAsync,
  processDocumentRouteAsync,
  processPatientRouteAsync,
} from "../../shared";

function parseElationPracticeIdDash(tokenData: JwtTokenData): ParseResponse {
  if (tokenData.source !== elationDashSource) throw new ForbiddenError();
  const practiceId = tokenData.practiceId;
  if (!practiceId) throw new ForbiddenError();
  return {
    externalId: practiceId,
    queryParams: {
      practiceId,
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

export function processCxIdDash(req: Request, res: Response, next: NextFunction) {
  processCxIdAsync(req, elationDashSource, parseElationPracticeIdDash).then(next).catch(next);
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
