import { NextFunction, Request, Response } from "express";
import { getAuthorizationToken } from "../util";
import { getJwtToken } from "../../command/jwt-token";
import { getCxMappingOrFail } from "../../command/mapping/cx";
import {
  PathDetails,
  validatePath,
  parseIdFromPathParams,
  parseIdFromQueryParams,
  replaceIdInQueryParams,
} from "./util";
import { JwtTokenData } from "../../domain/jwt-token";
import { EhrSources } from "../../external/ehr/shared";
import ForbiddenError from "../../errors/forbidden";

export type ParseResponse = {
  externalId: string;
  queryParams?: { [k: string]: string };
};

export function processCxIdCanvas(req: Request, res: Response, next: NextFunction) {
  processCxIdCanvasAsync(req)
    .then(() => next())
    .catch(next);
}

export async function processCxIdCanvasAsync(req: Request): Promise<void> {
  req.cxId = "cdb678ab-07e3-42c5-93f5-5541cf1f15a8";
}

export async function processCxIdAsync(
  req: Request,
  source: EhrSources.athena,
  parseExternalId: (tokenData: JwtTokenData) => ParseResponse
): Promise<void> {
  const accessToken = getAuthorizationToken(req);
  const authInfo = await getJwtToken({
    token: accessToken,
    source,
  });
  if (!authInfo) throw new ForbiddenError();
  const { externalId, queryParams } = parseExternalId(authInfo.data);
  const customer = await getCxMappingOrFail({
    externalId,
    source,
  });
  req.cxId = customer.cxId;
  if (queryParams) {
    req.query = {
      ...req.query,
      ...queryParams,
    };
  }
}

export const validPatientPaths: PathDetails[] = [
  {
    pathRegex: new RegExp(`^/$`),
    pathParamKey: "id",
  },
  {
    pathRegex: new RegExp(`^/consolidated/count$`),
    pathParamKey: "id",
  },
  {
    pathRegex: new RegExp(`^/consolidated/query$`),
    pathParamKey: "id",
  },
  {
    pathRegex: new RegExp(`^/consolidated/webhook$`),
    pathParamKey: "id",
  },
  {
    pathRegex: new RegExp(`^/medical-record$`),
    pathParamKey: "id",
  },
  {
    pathRegex: new RegExp(`^/medical-record-status$`),
    pathParamKey: "id",
  },
];

export const validedDocumentPaths: PathDetails[] = [
  {
    pathRegex: new RegExp(`^/$`),
    queryParamKey: "patientId",
  },
  {
    pathRegex: new RegExp(`^/query$`),
    queryParamKey: "patientId",
  },
  {
    pathRegex: new RegExp(`^/download-url$`),
  },
];

export async function processPatientRouteAsync(req: Request, source: EhrSources): Promise<void> {
  const path = validatePath(req, validPatientPaths);
  if (path.pathParamKey) {
    const externalId = parseIdFromPathParams(req, path.pathParamKey);
    await replaceIdInQueryParams(req, source, externalId);
  }
}

export async function processDocumentRouteAsync(req: Request, source: EhrSources): Promise<void> {
  const path = validatePath(req, validedDocumentPaths);
  if (path.queryParamKey) {
    const externalId = parseIdFromQueryParams(req, path.queryParamKey);
    await replaceIdInQueryParams(req, source, externalId);
  }
}
