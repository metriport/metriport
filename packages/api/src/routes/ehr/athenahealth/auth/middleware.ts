import { NextFunction, Request, Response } from "express";
import { getCxMapping } from "../../../../command/mapping/cx";
import { getPatientMapping } from "../../../../command/mapping/patient";
import { getJwtToken } from "../../../../command/jwt-token";
import { EhrSources } from "../../../../external/ehr/shared";
import { getAuthorizationToken } from "../../../util";
import {
  patientBasePath,
  documentBasePath,
  validPatientRoutes,
  validedDocumentRoutes,
  RouteDetails,
} from "../../shared";
import NotFoundError from "../../../../errors/not-found";

export function processCxId(req: Request, res: Response, next: NextFunction) {
  processCxIdAsync(req)
    .then(() => next())
    .catch(next);
}

async function processCxIdAsync(req: Request): Promise<void> {
  const accessToken = getAuthorizationToken(req);
  const authInfo = await getJwtToken({
    token: accessToken,
    source: EhrSources.ATHENA,
  });
  if (!authInfo) throw new NotFoundError(`No AthenaHealth token found`);
  const cxExternalId = (authInfo.data as { ah_practice?: string }).ah_practice;
  if (!cxExternalId) throw new Error(`No AthenaHealth externalId value found`);
  const existingCustomer = await getCxMapping({
    externalId: cxExternalId,
    source: EhrSources.ATHENA,
  });
  if (!existingCustomer) throw new NotFoundError(`No AthenaHealth customer found for externalId`);
  const cxId = existingCustomer.cxId;
  req.cxId = cxId;
  let pathValidation: PathValidation | undefined = undefined;
  if (req.path.startsWith(patientBasePath)) {
    pathValidation = validateAndParseRequest(req, validPatientRoutes);
  } else if (req.path.startsWith(documentBasePath)) {
    pathValidation = validateAndParseRequest(req, validedDocumentRoutes);
  }
  if (pathValidation?.paramReplace) {
    const externalId = pathValidation.paramReplace;
    const patietMapping = await getPatientMapping({
      cxId,
      externalId,
      source: EhrSources.ATHENA,
    });
    if (!patietMapping) throw new NotFoundError(`No AthenaHealth patient found for customer`);
    req.url = req.url.replace(externalId, patietMapping.patientId);
  } else if (pathValidation?.queryReplace) {
    const externalId = pathValidation.queryReplace.externalId;
    const patietMapping = await getPatientMapping({
      cxId,
      externalId,
      source: EhrSources.ATHENA,
    });
    if (!patietMapping) throw new NotFoundError(`No AthenaHealth patient found for customer`);
    req.query[pathValidation.queryReplace.queryParam] = patietMapping.patientId;
  }
}

type PathValidation = {
  paramReplace?: string;
  queryReplace?: QueryReplace;
};
type QueryReplace = { externalId: string; queryParam: string };

function validateAndParseRequest(req: Request, validPaths: RouteDetails): PathValidation {
  let found = false;
  let paramReplace: string | undefined = undefined;
  let queryReplace: QueryReplace | undefined = undefined;
  validPaths.map(path => {
    const matches = req.path.match(path.regex);
    if (matches) {
      if (found) throw new Error("Request path matches more than one valide path.");
      found = true;
      if (path.paramMatchIndex) {
        const paramValue = matches[path.paramMatchIndex];
        paramReplace = paramValue;
      } else if (path.queryParam) {
        if (!req.query) throw new Error("Request missing query params when required.");
        const queryParamValue = req.query[path.queryParam];
        if (!queryParamValue) throw new Error("Request missing query param value when required.");
        if (typeof queryParamValue !== "string") {
          throw new Error("Request query param value is wrong type.");
        }
        queryReplace = { externalId: queryParamValue, queryParam: path.queryParam };
      }
    }
  });
  if (!found) throw new Error("Invalid path");
  return {
    paramReplace,
    queryReplace,
  };
}
