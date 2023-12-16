import { NextFunction, Request, Response } from "express";
import { nanoid } from "nanoid";
import { analyzeRoute } from "./request-analytics";

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const reqId = nanoid();
  const method = req.method;
  const url = req.baseUrl + req.path;
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

    analyzeRoute({ req, method, url, duration: elapsedTimeInMs });
  });
  next();
};

function toString(obj: unknown): string {
  return obj ? ` ${JSON.stringify(obj)}` : "";
}
