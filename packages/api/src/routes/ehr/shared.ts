import { Request } from "express";
import { BadRequestError } from "@metriport/shared";
import { getJwtToken } from "../../command/jwt-token";
import { getCxMappingOrFail } from "../../command/mapping/cx";
import { getPatientMappingOrFail } from "../../command/mapping/patient";
import { JwtTokenData } from "../../domain/jwt-token";
import { PatientMappingSource } from "../../domain/patient-mapping";
import ForbiddenError from "../../errors/forbidden";
import {
  EhrOauthJwtTokenSource,
  EhrWebhookJwtTokenSource,
  getEhrSourceFromJwtTokenSource,
} from "../../external/ehr/shared";
import { getAuthorizationToken } from "../util";
import { parseIdFromPathParams, parseIdFromQueryParams, PathDetails, validatePath } from "./util";

export type ParseResponse = {
  externalId: string;
  queryParams?: { [k: string]: string };
};

export async function processCxIdAsync(
  req: Request,
  tokenSource: EhrOauthJwtTokenSource | EhrWebhookJwtTokenSource,
  parseExternalId: (tokenData: JwtTokenData) => ParseResponse
): Promise<void> {
  const accessToken = getAuthorizationToken(req);
  const authInfo = await getJwtToken({ token: accessToken, source: tokenSource });
  if (!authInfo) throw new ForbiddenError();
  if (authInfo.exp < new Date()) throw new ForbiddenError();
  const { externalId, queryParams } = parseExternalId(authInfo.data);
  const cxMappingSource = getEhrSourceFromJwtTokenSource(tokenSource);
  const customer = await getCxMappingOrFail({ externalId, source: cxMappingSource });
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

export async function processPatientRouteAsync(
  req: Request,
  source: PatientMappingSource
): Promise<void> {
  const path = validatePath(req, validPatientPaths);
  if (path.pathParamKey) {
    const externalId = parseIdFromPathParams(req, path.pathParamKey);
    await replaceIdInQueryParams(req, source, externalId);
  }
}

export async function processDocumentRouteAsync(
  req: Request,
  source: PatientMappingSource
): Promise<void> {
  const path = validatePath(req, validedDocumentPaths);
  if (path.queryParamKey) {
    const externalId = parseIdFromQueryParams(req, path.queryParamKey);
    await replaceIdInQueryParams(req, source, externalId);
  }
}

export async function replaceIdInQueryParams(
  req: Request,
  source: PatientMappingSource,
  externalId: string
): Promise<void> {
  if (!req.cxId) throw new BadRequestError("Trouble processisng request");
  const patient = await getPatientMappingOrFail({
    cxId: req.cxId,
    externalId,
    source,
  });
  req.query["patientId"] = patient.patientId;
}
