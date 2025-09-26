import { epicDashSource } from "@metriport/shared/interface/external/ehr/epic/jwt-token";
import { NextFunction, Request, Response } from "express";
import { JwtTokenData } from "../../../../domain/jwt-token";
import ForbiddenError from "../../../../errors/forbidden";
import {
  ParseResponse,
  processCxId as processCxIdShared,
  processDocumentRoute as processDocumentRouteShared,
  processPatientRoute as processPatientRouteShared,
} from "../../shared";

export const tokenEhrPatientIdQueryParam = "epicPatientIdFromToken";

function parseEpicPracticeIdDash(tokenData: JwtTokenData, tokenId: string): ParseResponse {
  if (tokenData.source !== epicDashSource) throw new ForbiddenError();
  const practiceId = tokenData.practiceId;
  if (!practiceId) throw new ForbiddenError();
  const instanceUrl = tokenData.instanceUrl;
  if (!instanceUrl) throw new ForbiddenError();
  const patientId = tokenData.patientId;
  if (!patientId) throw new ForbiddenError();
  return {
    externalId: practiceId,
    queryParams: {
      practiceId,
      instanceUrl,
      tokenId,
      [tokenEhrPatientIdQueryParam]: patientId,
    },
  };
}

export function processCxIdDash(req: Request, res: Response, next: NextFunction) {
  processCxIdShared(req, epicDashSource, parseEpicPracticeIdDash).then(next).catch(next);
}

export function processPatientRoute(req: Request, res: Response, next: NextFunction) {
  processPatientRouteShared(req, epicDashSource).then(next).catch(next);
}

export function processDocumentRoute(req: Request, res: Response, next: NextFunction) {
  processDocumentRouteShared(req, epicDashSource).then(next).catch(next);
}
