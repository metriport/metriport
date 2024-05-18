import { NextFunction, Request, Response } from "express";
import { customAlphabet } from "nanoid";
import { getLocalStorage } from "@metriport/core/util/local-storage";
import { analyzeRoute } from "./request-analytics";

const asyncLocalStorage = getLocalStorage("reqId");
const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz");

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const reqId = nanoid();
  asyncLocalStorage.run(reqId, () => {
    const method = req.method;
    const url = req.baseUrl + req.path;
    const urlWithParams = replaceParamWithKey(url, req.params);
    const query = req.query && Object.keys(req.query).length ? req.query : undefined;
    const params = req.params && Object.keys(req.params).length ? req.params : undefined;

    console.log(
      "%s ..........Begins %s %s %s %s",
      reqId,
      method,
      url,
      toString(params),
      toString(query)
    );

    const startHrTime = process.hrtime();

    res.on("close", () => {
      const elapsedHrTime = process.hrtime(startHrTime);
      const elapsedTimeInMs = elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1e6;
      console.log(
        "%s ..........Done %s %s | %d | %fms",
        reqId,
        method,
        url,
        res.statusCode,
        elapsedTimeInMs
      );

      const isSuccessful = res.statusCode >= 200 && res.statusCode < 300;

      if (isSuccessful) {
        analyzeRoute({ req, method, url: urlWithParams, params, query, duration: elapsedTimeInMs });
      }
    });
    next();
  });
};

function replaceParamWithKey(url: string, params: Record<string, string>): string {
  return Object.keys(params).reduce((acc, key) => acc.replace(params[key], `:${key}`), url);
}

function toString(obj: unknown): string {
  return obj ? ` ${JSON.stringify(obj)}` : "";
}
