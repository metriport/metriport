import { NextFunction, Request, Response } from "express";
import { EhrSources } from "../../../../external/ehr/shared";
import {
  parseResponse,
  processCxIdAsync,
  processPatientRouteAsync,
  processDocumentRouteAsync,
} from "../../shared";
import BadRequestError from "../../../../errors/bad-request";

function parseAthenaHealthPracticeId(tokenData: {
  ah_practice?: string;
  ah_deparment?: string;
}): parseResponse {
  const practiceId = tokenData.ah_practice;
  if (!practiceId) throw new BadRequestError("Missing exteranl mapping on token data");
  const deparmentId = tokenData.ah_deparment;
  return {
    externalId: practiceId,
    queryParams: {
      practiceId: practiceId.replace("a-1.Practice-", ""),
      ...(deparmentId && { deparmentId: deparmentId.replace("a-1.Deparment-", "") }),
    },
  };
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
