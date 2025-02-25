import { BadRequestError } from "@metriport/shared";
import { Request } from "express";

export const idRegex = "([a-zA-Z0-9\\_\\-\\.])+";

export type PathDetails = {
  pathRegex: RegExp;
  pathParamKey?: string;
  queryParamKey?: string;
};

export function validatePath(req: Request, paths: PathDetails[]): PathDetails {
  const validPaths = paths.filter(path => path.pathRegex.test(req.path));
  if (validPaths.length === 0) throw new BadRequestError(`Invalid path ${req.path}`);
  if (validPaths.length > 1)
    throw new BadRequestError(`More than one path matched for ${req.path}`);
  return validPaths[0];
}

export function parseIdFromPathParams(req: Request, pathParamkey: string): string {
  if (!req.params) throw new BadRequestError(`Request missing path params`);
  const pathParamValue = req.params[pathParamkey];
  if (!pathParamValue) throw new BadRequestError(`Request missing path param ${pathParamkey}`);
  const re = new RegExp(idRegex);
  if (!re.test(pathParamValue)) {
    throw new BadRequestError(`Value for path param ${pathParamValue} is incorrectly formmated`);
  }
  return pathParamValue;
}

export function parseIdFromQueryParams(req: Request, queryParamKey: string): string {
  if (!req.query) throw new BadRequestError(`Request missing query params`);
  const queryParamValue = req.query[queryParamKey];
  if (!queryParamValue) throw new BadRequestError(`Request missing query param ${queryParamKey}`);
  if (typeof queryParamValue !== "string") {
    throw new BadRequestError(`Type for query param ${queryParamKey} is not string`);
  }
  const re = new RegExp(idRegex);
  if (!re.test(queryParamValue)) {
    throw new BadRequestError(`Value for query param ${queryParamKey} is incorrectly formmated`);
  }
  return queryParamValue;
}
