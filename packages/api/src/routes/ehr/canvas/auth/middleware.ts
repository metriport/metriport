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

function parseCanvasPracticeId(tokenData: JwtTokenData): ParseResponse {
  if (tokenData.source !== EhrSources.canvas) throw new ForbiddenError();
  const practiceId = tokenData.practiceId;
  return {
    externalId: practiceId,
    queryParams: {
      practiceId,
    },
  };
}

export function processCxId(req: Request, res: Response, next: NextFunction) {
  processCxIdAsync(req, EhrSources.canvas, parseCanvasPracticeId)
    .then(() => next())
    .catch(next);
}

export function processPatientRoute(req: Request, res: Response, next: NextFunction) {
  processPatientRouteAsync(req, EhrSources.canvas)
    .then(() => next())
    .catch(next);
}

export function processDocumentRoute(req: Request, res: Response, next: NextFunction) {
  processDocumentRouteAsync(req, EhrSources.canvas)
    .then(() => next())
    .catch(next);
}
