import { NextFunction, Request, Response } from "express";
import { BadRequestError } from "@metriport/shared";
import { EhrSources } from "../../../../external/ehr/shared";
import {
  ParseResponse,
  processCxIdAsync,
  processPatientRouteAsync,
  processDocumentRouteAsync,
} from "../../shared";

function parseAthenaHealthPracticeId(tokenData: {
  ah_practice?: string;
  ah_department?: string;
}): ParseResponse {
  const practiceId = tokenData.ah_practice;
  if (!practiceId) {
    throw new BadRequestError("Missing required external mapping value on token data");
  }
  const departmentId = tokenData.ah_department;
  return {
    externalId: practiceId,
    queryParams: {
      practiceId,
      ...(departmentId && { departmentId: departmentId }),
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
