import { NextFunction, Request, Response } from "express";
import { JwtTokenData } from "../../../../domain/jwt-token";
import ForbiddenError from "../../../../errors/forbidden";
import { EhrSources } from "../../../../external/ehr/shared";
import {
  ParseResponse,
  processCxIdAsync,
  processDocumentRouteAsync,
  processPatientRouteAsync,
} from "../../shared";

function parseElationPracticeId(tokenData: JwtTokenData): ParseResponse {
  if (tokenData.source !== EhrSources.elation) throw new ForbiddenError();
  const practiceId = tokenData.practiceId;
  if (!practiceId) throw new ForbiddenError();
  return {
    externalId: practiceId,
    queryParams: {
      practiceId,
    },
  };
}

export function processCxId(req: Request, res: Response, next: NextFunction) {
  processCxIdAsync(req, EhrSources.elation, parseElationPracticeId)
    .then(() => next())
    .catch(next);
}

export function processPatientRoute(req: Request, res: Response, next: NextFunction) {
  processPatientRouteAsync(req, EhrSources.elation)
    .then(() => next())
    .catch(next);
}

export function processDocumentRoute(req: Request, res: Response, next: NextFunction) {
  processDocumentRouteAsync(req, EhrSources.elation)
    .then(() => next())
    .catch(next);
}
