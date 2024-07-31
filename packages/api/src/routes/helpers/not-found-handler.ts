import { NextFunction, Request, Response } from "express";
import { Config } from "../../shared/config";
import { requestLogger } from "./request-logger";

export const notFoundHandlers = [
  (req: Request, res: Response, next: NextFunction): void => {
    if (isLogClientErrors(req)) return requestLogger(req, res, next);
    return next();
  },
  (req: Request, res: Response) => {
    return res.status(404).send({ message: "Not Found" });
  },
];

function isLogClientErrors(req: Request): boolean | undefined {
  if (Config.isProdEnv() || Config.isSandbox()) return false;
  const raw = req.headers["x-log-client-errors"];
  return raw === "true";
}
