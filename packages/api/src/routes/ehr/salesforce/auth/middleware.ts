import { salesforceDashSource } from "@metriport/shared/interface/external/ehr/salesforce/jwt-token";
import { NextFunction, Request, Response } from "express";
import { JwtTokenData } from "../../../../domain/jwt-token";
import ForbiddenError from "../../../../errors/forbidden";
import {
  ParseResponse,
  processCxId as processCxIdShared,
  processDocumentRoute as processDocumentRouteShared,
  processPatientRoute as processPatientRouteShared,
} from "../../shared";

function parseSalesforcePracticeIdDash(tokenData: JwtTokenData, tokenId: string): ParseResponse {
  if (tokenData.source !== salesforceDashSource) throw new ForbiddenError();
  const sfOrgId = tokenData.sfOrgId;
  if (!sfOrgId) throw new ForbiddenError();
  const sfInstanceUrl = tokenData.sfInstanceUrl;
  if (!sfInstanceUrl) throw new ForbiddenError();
  return {
    externalId: sfOrgId,
    queryParams: {
      sfOrgId,
      sfInstanceUrl,
      tokenId,
    },
  };
}

export function processCxIdDash(req: Request, res: Response, next: NextFunction) {
  processCxIdShared(req, salesforceDashSource, parseSalesforcePracticeIdDash)
    .then(next)
    .catch(next);
}

export function processPatientRoute(req: Request, res: Response, next: NextFunction) {
  processPatientRouteShared(req, salesforceDashSource).then(next).catch(next);
}

export function processDocumentRoute(req: Request, res: Response, next: NextFunction) {
  processDocumentRouteShared(req, salesforceDashSource).then(next).catch(next);
}
