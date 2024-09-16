import { Request } from "express";
import { capture } from "@metriport/core/util/notifications";
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
import BadRequestError from "../../errors/bad-request";

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
export const DocumentBasePath = "/medical/v1/Document";

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
  if (!path.paramRegexIndex) {
    capture.error("Must include paramRegexIndex on patient paths", { extra: { path } });
    throw new BadRequestError("Trouble processisng request");
  }
  const externalId = parseIdFromPathParams(req, path.regex, path.paramRegexIndex);
  await replaceIdInUrlAndQuery(req, source, externalId);
}

export async function processDocumentRouteAsync(req: Request, source: EhrSources): Promise<void> {
  const path = validatePath(req, validedDocumentPaths);
  if (!path.queryParamKey) {
    capture.error("Must include queryParamKey on document paths", { extra: { path } });
    throw new BadRequestError("Trouble processisng request");
  }
  const externalId = parseIdFromQueryParams(req, path.queryParamKey);
  await replaceIdInUrlAndQuery(req, source, externalId);
}
