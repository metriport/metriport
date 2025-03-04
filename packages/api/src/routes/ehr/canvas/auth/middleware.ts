import { NextFunction, Request, Response } from "express";
import { JwtTokenData } from "../../../../domain/jwt-token";
import ForbiddenError from "../../../../errors/forbidden";
import { canvasWebhookJwtTokenSource } from "../../../../external/ehr/canvas/shared";
import { EhrSources } from "../../../../external/ehr/shared";
import {
  ParseResponse,
  processCxIdAsync,
  processDocumentRouteAsync,
  processPatientRouteAsync,
} from "../../shared";

function parseCanvasPracticeIdDash(tokenData: JwtTokenData): ParseResponse {
  if (tokenData.source !== EhrSources.canvas) throw new ForbiddenError();
  const practiceId = tokenData.practiceId;
  return {
    externalId: practiceId,
    queryParams: {
      practiceId,
    },
  };
}

function parseCanvasPracticeIdWebhook(tokenData: JwtTokenData): ParseResponse {
  if (tokenData.source !== canvasWebhookJwtTokenSource) throw new ForbiddenError();
  const practiceId = tokenData.practiceId;
  return {
    externalId: practiceId,
    queryParams: {
      practiceId,
    },
  };
}

export function processCxIdDash(req: Request, res: Response, next: NextFunction) {
  processCxIdAsync(req, EhrSources.canvas, parseCanvasPracticeIdDash)
    .then(() => next())
    .catch(next);
}

export function processCxIdWebhooks(req: Request, res: Response, next: NextFunction) {
  processCxIdAsync(req, canvasWebhookJwtTokenSource, parseCanvasPracticeIdWebhook)
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
