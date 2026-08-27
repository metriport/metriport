import { athenaDashSource } from "@metriport/shared/interface/external/ehr/athenahealth/jwt-token";
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

function parseAthenaHealthPracticeIdDash(tokenData: JwtTokenData): ParseResponse {
  if (tokenData.source !== athenaDashSource) throw new ForbiddenError();
  const practiceId = tokenData.ah_practice;
  if (!practiceId) throw new ForbiddenError();
  const departmentId = tokenData.ah_department;
  if (!departmentId) throw new ForbiddenError();
  return {
    externalId: practiceId,
    queryParams: {
      practiceId,
      departmentId,
    },
  };
}

export function processCxIdDash(req: Request, res: Response, next: NextFunction) {
  processCxIdShared(req, athenaDashSource, parseAthenaHealthPracticeIdDash).then(next).catch(next);
}

export function processPatientRoute(req: Request, res: Response, next: NextFunction) {
  processPatientRouteShared(req, athenaDashSource).then(next).catch(next);
}

export function processDocumentRoute(req: Request, res: Response, next: NextFunction) {
  processDocumentRouteShared(req, athenaDashSource).then(next).catch(next);
}

export function processInferenceRoute(req: Request, res: Response, next: NextFunction) {
  processInferenceRouteShared(req).then(next).catch(next);
}

export function processFeatureFlagsRoute(req: Request, res: Response, next: NextFunction) {
  processFeatureFlagsRouteShared(req).then(next).catch(next);
}
