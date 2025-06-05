import { touchworksDashSource } from "@metriport/shared/interface/external/ehr/touchworks/jwt-token";
import { NextFunction, Request, Response } from "express";
import { JwtTokenData } from "../../../../domain/jwt-token";
import ForbiddenError from "../../../../errors/forbidden";
import {
  ParseResponse,
  processCxId as processCxIdShared,
  processDocumentRoute as processDocumentRouteShared,
  processPatientRoute as processPatientRouteShared,
} from "../../shared";

export const tokenEhrPatientIdQueryParam = "touchworksPatientIdFromToken";

function parseTouchWorksPracticeIdDash(tokenData: JwtTokenData, tokenId: string): ParseResponse {
  if (tokenData.source !== touchworksDashSource) throw new ForbiddenError();
  const practiceId = tokenData.practiceId;
  if (!practiceId) throw new ForbiddenError();
  const patientId = tokenData.patientId;
  if (!patientId) throw new ForbiddenError();
  return {
    externalId: practiceId,
    queryParams: {
      practiceId,
      tokenId,
      [tokenEhrPatientIdQueryParam]: patientId,
    },
  };
}

export function processCxIdDash(req: Request, res: Response, next: NextFunction) {
  processCxIdShared(req, touchworksDashSource, parseTouchWorksPracticeIdDash)
    .then(next)
    .catch(next);
}

export function processPatientRoute(req: Request, res: Response, next: NextFunction) {
  processPatientRouteShared(req, touchworksDashSource).then(next).catch(next);
}

export function processDocumentRoute(req: Request, res: Response, next: NextFunction) {
  processDocumentRouteShared(req, touchworksDashSource).then(next).catch(next);
}
