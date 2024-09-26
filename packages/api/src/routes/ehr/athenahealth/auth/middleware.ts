import { NextFunction, Request, Response } from "express";
import { EhrSources } from "../../../../external/ehr/shared";
import { JwtTokenData } from "../../../../domain/jwt-token";
import {
  ParseResponse,
  processCxIdAsync,
  processPatientRouteAsync,
  processDocumentRouteAsync,
} from "../../shared";

function parseAthenaHealthPracticeId(tokenData: JwtTokenData): ParseResponse {
  const practiceId = tokenData.ah_practice;
  const departmentId = tokenData.ah_department;
  return {
    externalId: practiceId,
    queryParams: {
      practiceId,
      departmentId,
    },
  };
}

export function processCxId(req: Request, res: Response, next: NextFunction) {
  processCxIdAsync(req, EhrSources.athena, parseAthenaHealthPracticeId)
    .then(() => next())
    .catch(next);
}

export function processPatientRoute(req: Request, res: Response, next: NextFunction) {
  processPatientRouteAsync(req, EhrSources.athena)
    .then(() => next())
    .catch(next);
}

export function processDocumentRoute(req: Request, res: Response, next: NextFunction) {
  processDocumentRouteAsync(req, EhrSources.athena)
    .then(() => next())
    .catch(next);
}
