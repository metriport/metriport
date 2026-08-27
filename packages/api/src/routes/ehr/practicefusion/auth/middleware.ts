import { practicefusionDashSource } from "@metriport/shared/interface/external/ehr/practicefusion/jwt-token";
import { NextFunction, Request, Response } from "express";
import { JwtTokenData } from "../../../../domain/jwt-token";
import ForbiddenError from "../../../../errors/forbidden";
import {
  ParseResponse,
  processCxId as processCxIdShared,
  processDocumentRoute as processDocumentRouteShared,
  processPatientRoute as processPatientRouteShared,
  processInferenceRoute as processInferenceRouteShared,
  processFeatureFlagsRoute as processFeatureFlagsRouteShared,
} from "../../shared";

export const tokenEhrPatientIdQueryParam = "practicefusionPatientIdFromToken";

function parsePracticeFusionPracticeIdDash(tokenData: JwtTokenData): ParseResponse {
  if (tokenData.source !== practicefusionDashSource) throw new ForbiddenError();
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

export function processCxIdDash(req: Request, res: Response, next: NextFunction) {
  processCxIdShared(req, practicefusionDashSource, parsePracticeFusionPracticeIdDash)
    .then(next)
    .catch(next);
}

export function processPatientRoute(req: Request, res: Response, next: NextFunction) {
  processPatientRouteShared(req, practicefusionDashSource).then(next).catch(next);
}

export function processDocumentRoute(req: Request, res: Response, next: NextFunction) {
  processDocumentRouteShared(req, practicefusionDashSource).then(next).catch(next);
}

export function processInferenceRoute(req: Request, res: Response, next: NextFunction) {
  processInferenceRouteShared(req).then(next).catch(next);
}

export function processFeatureFlagsRoute(req: Request, res: Response, next: NextFunction) {
  processFeatureFlagsRouteShared(req).then(next).catch(next);
}
