import { getLocalStorage } from "@metriport/core/util/local-storage";
import { NextFunction, Request, Response } from "express";
import { customAlphabet } from "nanoid";
import { getCxId, getCxIdFromQuery } from "../util";
import { analyzeRoute } from "./request-analytics";
import { out } from "@metriport/core/util";

const asyncLocalStorage = getLocalStorage("reqId");
const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz");
const { log } = out("request-logger");

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const reqId = nanoid();
  // TODO move the asyncLocalStorage logic to its own, dedicated middleware
  asyncLocalStorage.run(reqId, () => {
    const method = req.method;
    const url = req.baseUrl + req.path;
    const urlWithParams = replaceParamWithKey(url, req.aggregatedParams);
    const { client, path } = splitUrlToClientAndPath(urlWithParams);

    const cxId = getCxId(req) ?? getCxIdFromQuery(req);
    const query = req.query && Object.keys(req.query).length ? req.query : undefined;
    const params =
      req.aggregatedParams && Object.keys(req.aggregatedParams).length
        ? req.aggregatedParams
        : undefined;

    log({
      message: "Begins",
      requestId: reqId,
      method,
      url,
      params,
      query,
      cxId,
    });

    const startHrTime = process.hrtime();

    res.on("close", () => {
      const elapsedHrTime = process.hrtime(startHrTime);
      const elapsedTimeInMs = elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1e6;
      log({
        message: "Done",
        requestId: reqId,
        method,
        url,
        status: res.statusCode,
        duration: elapsedTimeInMs,
      });

      analyzeRoute({
        req,
        method,
        client,
        url: path,
        params,
        query,
        duration: elapsedTimeInMs,
        status: res.statusCode,
      });
    });
    next();
  });
};

export function splitUrlToClientAndPath(url: string): { client?: string; path: string } {
  const separator = "/medical/v1";
  const separatorIndex = url.indexOf(separator);

  if (separatorIndex === -1) {
    return { path: url };
  }

  const clientSlice = url.slice(0, separatorIndex);
  const pathSlice = url.slice(separatorIndex);

  const client = clientSlice.length > 0 ? clientSlice.replace(/\//g, " ").trim() : undefined;

  return { client, path: pathSlice };
}

function replaceParamWithKey(url: string, params: Record<string, string> | undefined): string {
  if (!params) return url;

  return Object.keys(params).reduce((acc, key) => acc.replace(params[key], `:${key}`), url);
}
