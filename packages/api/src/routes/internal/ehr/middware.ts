import { BadRequestError } from "@metriport/shared";
import { NextFunction, Request, Response } from "express";
import { isEhrSource } from "../../../../../shared/dist";
import { getFrom } from "../../util";

export function processEhrId(req: Request, res: Response, next: NextFunction) {
  const ehrId = getFrom("params").orFail("ehrId", req);
  if (!isEhrSource(ehrId)) throw new BadRequestError("Invalid EHR", undefined, { ehrId });
  req.query = { ...req.query, ehrId };
  next();
}
