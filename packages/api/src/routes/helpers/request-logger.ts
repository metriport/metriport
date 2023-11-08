import { NextFunction, Request, Response } from "express";
import { analyzeRoute } from "./request-analytics";

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const method = req.method;
  const url = req.baseUrl + req.path;
  const query = req.query && Object.keys(req.query).length ? req.query : undefined;
  const params = req.params && Object.keys(req.params).length ? req.params : undefined;
  console.log("..........Begins %s %s %s %s", method, url, toString(params), toString(query));
  const startHrTime = process.hrtime();
  res.on("close", () => {
    const elapsedHrTime = process.hrtime(startHrTime);
    const elapsedTimeInMs = elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1e6;
    console.log("..........Done %s %s | %d | %fms", method, url, res.statusCode, elapsedTimeInMs);

    analyzeRoute({ req, method, url, duration: elapsedTimeInMs });
  });
  next();
};

function toString(obj: unknown): string {
  return obj ? ` ${JSON.stringify(obj)}` : "";
}
