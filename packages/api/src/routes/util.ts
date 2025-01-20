import { out } from "@metriport/core/util/log";
import { errorToString, stringToBoolean } from "@metriport/shared";
import { NextFunction, Request, Response } from "express";
import BadRequestError from "../errors/bad-request";
import { Config } from "../shared/config";
import { capture } from "../shared/notifications";

const { log } = out("asyncHandler");

export function asyncHandler(
  f: (
    req: Request,
    res: Response,
    next: NextFunction
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<Response<any, Record<string, any>> | void>,
  logErrorDetails = !Config.isCloudEnv()
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await f(req, res, next);
    } catch (err) {
      if (logErrorDetails) log("", err);
      else log(removeNewLines(errorToString(err)));
      next(err);
    }
  };
}

function removeNewLines(s: string): string {
  return (s ?? "").replace(/\n/g, " ");
}

// https://www.rfc-editor.org/rfc/rfc7807 w/ Metriport extension, { name?: string }
export type HttpResponseBody = { status: number; title: string; detail?: string; name?: string };
export function httpResponseBody({
  status,
  title,
  detail,
  name,
}: {
  status: number;
  title: string;
  detail?: string;
  name?: string;
}): HttpResponseBody {
  return {
    status,
    title,
    detail,
    name,
  };
}

export const getFromQuery = (prop: string, req: Request): string | undefined => {
  const value = req.query[prop];
  if (typeof value === "string") return value;
  if (value == undefined) return undefined;
  throw new BadRequestError(`Invalid ${prop} query param - must be string`);
};
export const getFromQueryOrFail = (prop: string, req: Request): string => {
  const value = getFromQuery(prop, req);
  if (!value) throw new BadRequestError(`Missing ${prop} query param`);
  return value;
};

export const getFromQueryAsArray = (prop: string, req: Request): string[] | undefined => {
  const value = req.query[prop];
  if (value == undefined) return undefined;
  if (typeof value === "string") return value.trim().split(",");
  if (Array.isArray(value)) {
    value.forEach(v => {
      if (typeof v !== "string") throw new BadRequestError(`Invalid ${prop} query param`);
    });
    return value as string[];
  }
  throw new BadRequestError(`Invalid ${prop} query param - must be array`);
};
export const getFromQueryAsArrayOrFail = (prop: string, req: Request) => {
  const value = getFromQueryAsArray(prop, req);
  if (!value) throw new BadRequestError(`Missing ${prop} query param`);
  return value;
};
export const getFromQueryAsBoolean = (prop: string, req: Request): boolean | undefined => {
  return stringToBoolean(getFrom("query").optional(prop, req));
};
export const getFromQueryAsBooleanOrFail = (prop: string, req: Request): boolean => {
  const value = getFromQueryAsBoolean(prop, req);
  if (value == undefined) throw new BadRequestError(`Missing ${prop} query param`);
  return value;
};

export const getFromParams = (prop: string, req: Request): string | undefined =>
  req.params[prop] as string | undefined;
export const getFromParamsOrFail = (prop: string, req: Request): string => {
  const value = getFromParams(prop, req);
  if (!value) throw new BadRequestError(`Missing ${prop} param`);
  return value;
};

export const getFromHeader = (prop: string, req: Request): string | undefined => req.header(prop);
export const getFromHeaderOrFail = (prop: string, req: Request): string => {
  const value = getFromHeader(prop, req);
  if (!value) throw new Error(`Missing ${prop} header`); // Plain Error bc this is app logic, not user error
  return value;
};

export interface GetWithParams {
  optional: (prop: string, req: Request) => string | undefined;
  orFail: (prop: string, req: Request) => string;
}
export interface GetWithoutParams extends GetWithParams {
  optional: () => string | undefined;
  orFail: () => string;
}
export type Context = "query" | "params" | "headers";
export const functionByContext: Record<Context, GetWithParams> = {
  query: {
    optional: getFromQuery,
    orFail: getFromQueryOrFail,
  },
  params: {
    optional: getFromParams,
    orFail: getFromParamsOrFail,
  },
  headers: {
    optional: getFromHeader,
    orFail: getFromHeaderOrFail,
  },
};
export function getFrom(context: Context): GetWithParams {
  return functionByContext[context];
}

export const getCxId = (req: Request): string | undefined => {
  const cxId = req.cxId;
  cxId && capture.setUser({ id: cxId });
  return cxId;
};
export const getCxIdOrFail = (req: Request): string => {
  const cxId = getCxId(req);
  if (!cxId) throw new BadRequestError("Missing cxId");
  return cxId;
};

export const getId = (req: Request): string | undefined => {
  return req.id;
};
export const getIdOrFail = (req: Request): string => {
  const id = getId(req);
  if (!id) throw new BadRequestError("Missing id on the request");
  return id;
};

export const getCxIdFromQuery = (req: Request): string | undefined => {
  const cxId = req.query.cxId as string | undefined;
  cxId && capture.setUser({ id: cxId });
  return cxId;
};
export const getCxIdFromQueryOrFail = (req: Request): string => {
  const cxId = getCxIdFromQuery(req);
  if (!cxId) throw new BadRequestError("Missing cxId query param");
  return cxId;
};

export const getCxIdFromHeaders = (req: Request): string | undefined => {
  const cxId = req.header("cxId") as string | undefined;
  cxId && capture.setUser({ id: cxId });
  return cxId;
};

/** @deprecated use getFromQuery() */
export const getDate = (req: Request): string | undefined => req.query.date as string | undefined;
/** @deprecated use getFromQueryOrFail() */
export const getDateOrFail = (req: Request): string => {
  const date = getDate(req);
  if (!date) throw new BadRequestError("Missing date query param");
  return date as string;
};

export function getAuthorizationToken(req: Request): string {
  const header = req.header("Authorization");
  if (!header) throw new Error("Missing Authorization Header");
  const token = header.replace("Bearer ", "");
  if (token === "") throw new Error("Empty Authorization Header");
  return token;
}
