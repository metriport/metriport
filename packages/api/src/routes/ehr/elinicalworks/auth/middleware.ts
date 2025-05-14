import { eclinicalworksDashSource } from "@metriport/shared/interface/external/ehr/eclinicalworks/jwt-token";
import { NextFunction, Request, Response } from "express";
import { JwtTokenData } from "../../../../domain/jwt-token";
import ForbiddenError from "../../../../errors/forbidden";
import {
  ParseResponse,
  processCxId as processCxIdShared,
  processDocumentRoute as processDocumentRouteShared,
  processPatientRoute as processPatientRouteShared,
} from "../../shared";

function parseEclinicalworksPracticeIdDash(tokenData: JwtTokenData): ParseResponse {
  if (tokenData.source !== eclinicalworksDashSource) throw new ForbiddenError();
  const practiceId = tokenData.practiceId;
  if (!practiceId) throw new ForbiddenError();
  const departmentId = tokenData.departmentId;
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
  processCxIdShared(req, eclinicalworksDashSource, parseEclinicalworksPracticeIdDash)
    .then(next)
    .catch(next);
}

export function processPatientRoute(req: Request, res: Response, next: NextFunction) {
  processPatientRouteShared(req, eclinicalworksDashSource).then(next).catch(next);
}

export function processDocumentRoute(req: Request, res: Response, next: NextFunction) {
  processDocumentRouteShared(req, eclinicalworksDashSource).then(next).catch(next);
}
