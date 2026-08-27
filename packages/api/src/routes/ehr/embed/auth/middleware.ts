import { embedDashSource } from "@metriport/shared/interface/external/ehr/embed/jwt-token";
import { NextFunction, Request, Response } from "express";
import { JwtTokenData } from "../../../../domain/jwt-token";
import ForbiddenError from "../../../../errors/forbidden";
import {
  ParseResponse,
  processCohortRoute as processCohortRouteShared,
  processCxId as processCxIdShared,
  processDocumentRoute as processDocumentRouteShared,
  processFacilityRoute as processFacilityRouteShared,
  processFeatureFlagsRoute as processFeatureFlagsRouteShared,
  processInferenceRoute as processInferenceRouteShared,
  processPatientRoute as processPatientRouteShared,
  processTcmEncounterRoute as processTcmEncounterRouteShared,
} from "../../shared";

function parseEmbedPracticeIdDash(tokenData: JwtTokenData): ParseResponse {
  if (tokenData.source !== embedDashSource) throw new ForbiddenError();
  const practiceId = tokenData.practiceId;
  if (!practiceId) throw new ForbiddenError();
  return {
    externalId: practiceId,
    queryParams: { practiceId },
  };
}

export function processCxIdDash(req: Request, res: Response, next: NextFunction) {
  processCxIdShared(req, embedDashSource, parseEmbedPracticeIdDash).then(next).catch(next);
}

export function processPatientRouteSkipMapping(req: Request, res: Response, next: NextFunction) {
  processPatientRouteShared(req, embedDashSource, true).then(next).catch(next);
}

export function processDocumentRouteSkipMapping(req: Request, res: Response, next: NextFunction) {
  processDocumentRouteShared(req, embedDashSource, true).then(next).catch(next);
}

export function processInferenceRoute(req: Request, res: Response, next: NextFunction) {
  processInferenceRouteShared(req).then(next).catch(next);
}

export function processFeatureFlagsRoute(req: Request, res: Response, next: NextFunction) {
  processFeatureFlagsRouteShared(req).then(next).catch(next);
}

export function processTcmEncounterRoute(req: Request, res: Response, next: NextFunction) {
  processTcmEncounterRouteShared(req).then(next).catch(next);
}

export function processFacilityRoute(req: Request, res: Response, next: NextFunction) {
  processFacilityRouteShared(req).then(next).catch(next);
}
export function processCohortRoute(req: Request, res: Response, next: NextFunction) {
  processCohortRouteShared(req).then(next).catch(next);
}
