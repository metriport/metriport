import { Request } from "express";
import { getPatientMappingOrFail } from "../../command/mapping/patient";
import { EhrSources } from "../../external/ehr/shared";

export const idRegex = "([a-zA-Z0-9\\_\\-\\.])+";

export type PathDetails = {
  regex: RegExp;
  paramRegexIndex?: number;
  queryParamKey?: string;
};

export function validatePath(req: Request, paths: PathDetails[]): PathDetails {
  const validPaths = paths.filter(path => path.regex.test(req.path));
  if (validPaths.length === 0) throw new Error(`Invalid path ${req.path}`);
  if (validPaths.length > 1) throw new Error(`More than one path matched for ${req.path}`);
  return validPaths[0];
}

export function parseIdFromPathParams(req: Request, regex: RegExp, regexIndex: number): string {
  const matches = req.path.match(regex);
  if (!matches) throw new Error("Request missing path param when required.");
  const paramValue = matches[regexIndex];
  if (!paramValue) throw new Error("Request missing path param when required.");
  return paramValue;
}

export function parseIdFromQueryParams(req: Request, queryParamKey: string): string {
  if (!req.query) throw new Error(`Request missing query param ${queryParamKey} when required`);
  const queryParamValue = req.query[queryParamKey];
  if (!queryParamValue)
    throw new Error(`Request missing query param ${queryParamKey} when required`);
  if (typeof queryParamValue !== "string")
    throw new Error(`Request type for query param ${queryParamKey} is not string`);
  return queryParamValue;
}

export async function replaceIdInUrl(
  req: Request,
  source: EhrSources,
  externalId: string
): Promise<void> {
  if (!req.cxId) throw new Error("Request missing cxId");
  const patient = await getPatientMappingOrFail({
    cxId: req.cxId,
    externalId,
    source,
  });
  console.log("req.url");
  console.log(req.url);
  const re = `/${externalId}/gi`;
  req.url = req.url.replace(re, patient.patientId);
  console.log(req.url);
}
