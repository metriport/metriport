import { NextFunction, Request, Response } from "express";
import { EhrSources } from "../../../../external/ehr/shared";
import {
  processCxIdAsync,
  processPatientRouteAsync,
  processDocuemntRouteAsync,
} from "../../shared";

function parseAthenaHealthPracticeId(tokenData: { ah_practice?: string }): string {
  const practiceId = tokenData.ah_practice;
  if (!practiceId) throw new Error("Missing ah_practice on token data");
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

export function processDocuemntRoute(req: Request, res: Response, next: NextFunction) {
  processDocuemntRouteAsync(req, EhrSources.ATHENA)
    .then(() => next())
    .catch(next);
}
