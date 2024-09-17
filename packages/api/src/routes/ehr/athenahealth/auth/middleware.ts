import { NextFunction, Request, Response } from "express";
import { EhrSources } from "../../../../external/ehr/shared";
import {
  processCxIdAsync,
  processPatientRouteAsync,
  processDocumentRouteAsync,
} from "../../shared";
import BadRequestError from "../../../../errors/bad-request";

function parseAthenaHealthPracticeId(tokenData: { ah_practice?: string }): string {
  const practiceId = tokenData.ah_practice;
  if (!practiceId) throw new BadRequestError("Missing exteranl mapping on token data");
  return practiceId;
}

export function processCxId(req: Request, res: Response, next: NextFunction) {
  processCxIdAsync(req, EhrSources.ATHENA, parseAthenaHealthPracticeId)
    .then(() => next())
    .catch(next);
}

export function processPatientRoute(req: Request, res: Response, next: NextFunction) {
  processPatientRouteAsync(req, EhrSources.ATHENA)
    .then(() => next())
    .catch(next);
}

export function processDocumentRoute(req: Request, res: Response, next: NextFunction) {
  processDocumentRouteAsync(req, EhrSources.ATHENA)
    .then(() => next())
    .catch(next);
}
