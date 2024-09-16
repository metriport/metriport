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
  replaceIdInUrl,
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
    regex: new RegExp(`^(${patientBasePath}/)(${idRegex})$`),
    paramRegexIndex: 2,
  },
  {
    regex: new RegExp(`^(${patientBasePath}/)(${idRegex})(/consolidated/count)$`),
    paramRegexIndex: 2,
  },
  {
    regex: new RegExp(`^(${patientBasePath}/)(${idRegex})(/consolidated/query)$`),
    paramRegexIndex: 2,
  },
  {
    regex: new RegExp(`^(${patientBasePath}/)(${idRegex})(/consolidated/webhook)$`),
    paramRegexIndex: 2,
  },
  {
    regex: new RegExp(`^(${patientBasePath}/)(${idRegex})(/medical-record)$`),
    paramRegexIndex: 2,
  },
  {
    regex: new RegExp(`^(${patientBasePath}/)(${idRegex})(/medical-record-status)$`),
    paramRegexIndex: 2,
  },
];

export const validedDocumentPaths: PathDetails[] = [
  {
    regex: new RegExp(`^(${documentBasePath})$`),
    queryParamKey: "patientId",
  },
  {
    regex: new RegExp(`^(${documentBasePath}/query)$`),
    queryParamKey: "patientId",
  },
];

export async function processPatientRouteAsync(req: Request, source: EhrSources): Promise<void> {
  const path = validatePath(req, validPatientPaths);
  if (!path.paramRegexIndex) throw new Error("Must define regex index for patient paths.");
  const externalId = parseIdFromPathParams(req, path.regex, path.paramRegexIndex);
  await replaceIdInUrl(req, source, externalId);
}

export async function processDocuemntRouteAsync(req: Request, source: EhrSources): Promise<void> {
  const path = validatePath(req, validedDocumentPaths);
  if (!path.queryParamKey) throw new Error("Must define query param for document paths.");
  const externalId = parseIdFromQueryParams(req, path.queryParamKey);
  await replaceIdInUrl(req, source, externalId);
}
