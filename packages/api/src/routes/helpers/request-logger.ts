import { NextFunction, Request, Response } from "express";
import { nanoid } from "nanoid";
import { getLocalStorage } from "@metriport/core/util/local-storage";
import { analyzeRoute } from "./request-analytics";

const asyncLocalStorage = getLocalStorage("reqId");

// TODO: 1411 - remove the DAPI-related routes when DAPI is fully discontinued
const blackListedRoutes = [
  "/internal/carequality/document-query/response",
  "/internal/carequality/document-retrieval/response",
  "/internal/carequality/patient-discovery/response",
  "/internal/mpi/patient",
  "/webhook/tenovi",
  "/webhook/fitbit",
  "/webhook/withings",
  "/webhook/garmin",
  "/webhook/apple",
];

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const reqId = nanoid();
  asyncLocalStorage.run(reqId, () => {
    const method = req.method;
    const url = req.baseUrl + req.path;
    const query = req.query && Object.keys(req.query).length ? req.query : undefined;
    const params = req.params && Object.keys(req.params).length ? req.params : undefined;

    if (isBlackListed(url)) {
      return next();
    }

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

      analyzeRoute({ req, method, url, duration: elapsedTimeInMs });
    });
    next();
  });
};

function isBlackListed(url: string): boolean {
  return blackListedRoutes.some(route => url.includes(route));
}

function toString(obj: unknown): string {
  return obj ? ` ${JSON.stringify(obj)}` : "";
}
