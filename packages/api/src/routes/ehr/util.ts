import { Request } from "express";
import { getPatientMappingOrFail } from "../../command/mapping/patient";
import { EhrSources } from "../../external/ehr/shared";
import BadRequestError from "../../errors/bad-request";

export const idRegex = "([a-zA-Z0-9\\_\\-\\.])+";

export type PathDetails = {
  regex: RegExp;
  paramRegexIndex?: number;
  queryParamKey?: string;
};

export function validatePath(req: Request, paths: PathDetails[]): PathDetails {
  const validPaths = paths.filter(path => path.regex.test(req.path));
  if (validPaths.length === 0) throw new BadRequestError(`Invalid path ${req.path}`);
  if (validPaths.length > 1)
    throw new BadRequestError(`More than one path matched for ${req.path}`);
  return validPaths[0];
}

export function parseIdFromPathParams(req: Request, regex: RegExp, regexIndex: number): string {
  const matches = req.path.match(regex);
  if (!matches) throw new BadRequestError("Request missing path param when required.");
  const paramValue = matches[regexIndex];
  if (!paramValue) throw new BadRequestError("Request missing path param when required.");
  return paramValue;
}

export function parseIdFromQueryParams(req: Request, queryParamKey: string): string {
  if (!req.query) throw new BadRequestError(`Request missing query param ${queryParamKey}`);
  const queryParamValue = req.query[queryParamKey];
  if (!queryParamValue) throw new BadRequestError(`Request missing query param ${queryParamKey}`);
  if (typeof queryParamValue !== "string") {
    throw new BadRequestError(`Query param type for query param ${queryParamKey} is not string`);
  }
  const re = new RegExp(idRegex);
  if (!re.test(queryParamValue)) {
    throw new BadRequestError(
      `Query param value for query param ${queryParamKey} is incorrectly formmated`
    );
  }
  return queryParamValue;
}

export async function replaceIdInUrlAndQuery(
  req: Request,
  source: EhrSources,
  externalId: string
): Promise<void> {
  if (!req.cxId) throw new BadRequestError("Trouble processisng request");
  const patient = await getPatientMappingOrFail({
    cxId: req.cxId,
    externalId,
    source,
  });
  const re = new RegExp(externalId, "g");
  req.url = req.url.replace(re, patient.patientId);
  if (req.query["patientId"]) req.query["patientId"] = patient.patientId;
}
