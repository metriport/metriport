import { Request } from "express";
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

export async function processCxIdAsync(
  req: Request,
  source: EhrSources.athena | EhrSources.canvas | EhrSources.elation,
  parseExternalId: (tokenData: JwtTokenData) => ParseResponse
): Promise<void> {
  const accessToken = getAuthorizationToken(req);
  const authInfo = await getJwtToken({
    token: accessToken,
    source,
  });
  if (!authInfo) throw new ForbiddenError();
  if (authInfo.exp < new Date()) throw new ForbiddenError();
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
