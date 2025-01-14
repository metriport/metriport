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

function parseAthenaHealthPracticeId(tokenData: JwtTokenData): ParseResponse {
  if (tokenData.source !== EhrSources.athena) throw new ForbiddenError();
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
