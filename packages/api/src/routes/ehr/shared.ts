import { Request } from "express";
import { getAuthorizationToken } from "../util";
import { getJwtTokenOrFail } from "../../command/jwt-token";
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

export async function processCxIdAsync(
  req: Request,
  source: EhrSources,
  parseExternalId: (tokenData: object) => string
): Promise<void> {
  const accessToken = getAuthorizationToken(req);
  const authInfo = await getJwtTokenOrFail({
    token: accessToken,
    source,
  });
  const externalId = parseExternalId(authInfo.data);
  const customer = await getCxMappingOrFail({
    externalId,
    source,
  });
  req.cxId = customer.cxId;
}

export const patientBasePath = "/medical/v1/patient";
export const documentBasePath = "/medical/v1/document";

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
];

export async function processPatientRouteAsync(req: Request, source: EhrSources): Promise<void> {
  const path = validatePath(req, validPatientPaths);
  if (!path.paramRegexIndex) throw new Error("Must define regex index for patient paths.");
  const externalId = parseIdFromPathParams(req, path.regex, path.paramRegexIndex);
  await replaceIdInUrlAndQuery(req, source, externalId);
}

export async function processDocuemntRouteAsync(req: Request, source: EhrSources): Promise<void> {
  const path = validatePath(req, validedDocumentPaths);
  if (!path.queryParamKey) throw new Error("Must define query param for document paths.");
  const externalId = parseIdFromQueryParams(req, path.queryParamKey);
  await replaceIdInUrlAndQuery(req, source, externalId);
}
