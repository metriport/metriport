import { Request } from "express";
import { getAuthorizationToken } from "../util";
import { getJwtToken } from "../../command/jwt-token";
import { getCxMappingOrFail } from "../../command/mapping/cx";
import {
  PathDetails,
  idRegex,
  validatePath,
  parseIdFromPathParams,
  parseIdFromQueryParams,
  replaceIdInUrlAndQuery,
} from "./util";
import { EhrSources } from "../../external/ehr/shared";
import ForbiddenError from "../../errors/forbidden";

export type ParseResponse = {
  externalId: string;
  queryParams?: { [k: string]: string };
};

export async function processCxIdAsync(
  req: Request,
  source: EhrSources,
  parseExternalId: (tokenData: object) => ParseResponse
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
    regex: new RegExp(`^/(${idRegex})$`),
    paramRegexIndex: 1,
  },
  {
    regex: new RegExp(`^/(${idRegex})(/consolidated/count)$`),
    paramRegexIndex: 1,
  },
  {
    regex: new RegExp(`^/(${idRegex})(/consolidated/query)$`),
    paramRegexIndex: 1,
  },
  {
    regex: new RegExp(`^/(${idRegex})(/consolidated/webhook)$`),
    paramRegexIndex: 1,
  },
  {
    regex: new RegExp(`^/(${idRegex})(/medical-record)$`),
    paramRegexIndex: 1,
  },
  {
    regex: new RegExp(`^/(${idRegex})(/medical-record-status)$`),
    paramRegexIndex: 1,
  },
];

export const validedDocumentPaths: PathDetails[] = [
  {
    regex: new RegExp(`^/$`),
    queryParamKey: "patientId",
  },
  {
    regex: new RegExp(`^/query$`),
    queryParamKey: "patientId",
  },
  {
    regex: new RegExp(`^/download-url$`),
  },
];

export async function processPatientRouteAsync(req: Request, source: EhrSources): Promise<void> {
  const path = validatePath(req, validPatientPaths);
  if (path.paramRegexIndex) {
    const externalId = parseIdFromPathParams(req, path.regex, path.paramRegexIndex);
    await replaceIdInUrlAndQuery(req, source, externalId);
  }
}

export async function processDocumentRouteAsync(req: Request, source: EhrSources): Promise<void> {
  const path = validatePath(req, validedDocumentPaths);
  if (path.queryParamKey) {
    const externalId = parseIdFromQueryParams(req, path.queryParamKey);
    await replaceIdInUrlAndQuery(req, source, externalId);
  }
}
