import { EhrSources } from "@metriport/core/external/shared/ehr";
import { NextFunction, Request, Response } from "express";
import { JwtTokenData } from "../../../../domain/jwt-token";
import ForbiddenError from "../../../../errors/forbidden";
import {
  ParseResponse,
  processCxIdAsync,
  processDocumentRouteAsync,
  processPatientRouteAsync,
} from "../../shared";

function parseAthenaHealthPracticeIdDash(tokenData: JwtTokenData): ParseResponse {
  if (tokenData.source !== EhrSources.athena) throw new ForbiddenError();
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
  processCxIdAsync(req, EhrSources.athena, parseAthenaHealthPracticeIdDash).then(next).catch(next);
}

export function processPatientRoute(req: Request, res: Response, next: NextFunction) {
  processPatientRouteAsync(req, EhrSources.athena).then(next).catch(next);
}

export function processDocumentRoute(req: Request, res: Response, next: NextFunction) {
  processDocumentRouteAsync(req, EhrSources.athena).then(next).catch(next);
}
