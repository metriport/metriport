import { NextFunction, Request, Response } from "express";
import { EhrSources } from "../../../../external/ehr/shared";
import {
  processCxIdAsync,
  processPatientRouteAsync,
  processDocuemntRouteAsync,
} from "../../shared";

function parseExternalId(tokenData: { ah_practice?: string }): string {
  const externalId = tokenData.ah_practice;
  if (!externalId) throw new Error("Missing ah_practice on token data");
  return externalId;
}

export function processCxId(req: Request, res: Response, next: NextFunction) {
  processCxIdAsync(req, EhrSources.ATHENA, parseExternalId)
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
