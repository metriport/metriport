import { base64ToString } from "@metriport/core/util/base64";
import { out } from "@metriport/core/util/log";
import { NextFunction, Request, Response } from "express";
import status from "http-status";
import { hasMapiAccess } from "../../command/medical/mapi-access";
import ForbiddenError from "../../errors/forbidden";
import { Config } from "../../shared/config";
import { getCxIdOrFail } from "../util";
import { getCxIdFromJwt } from "./propelauth";

/**
 * Process the API key and get the customer id.
 * The customer id is stored on the Request, property 'cxId'.
 */
export async function processCxId(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Just gets the cxId from the API Key, the actual auth is done on API GW.
    // Downstream routes should check whether `cxId` is present on the request or not.
    const encodedApiKey = req.header("x-api-key");
    req.cxId = getCxIdFromApiKey(encodedApiKey);
  } catch (error) {
    try {
      // If the API Key is not present, get the cxId from the JWT (requests from the Dash).
      req.cxId = await getCxIdFromJwt(req);
    } catch (error) {
      return next(new ForbiddenError());
    }
  }
  next();
}

export function getCxIdFromApiKey(encodedApiKey: string | undefined): string {
  if (!encodedApiKey) throw new ForbiddenError();
  const apiKey = base64ToString(encodedApiKey);
  const splitApiKey = apiKey.split(":");
  if (splitApiKey.length !== 2) throw new ForbiddenError();
  const cxId = splitApiKey[1];
  if (!isValidCxId(cxId)) throw new ForbiddenError();
  return cxId;
}

/**
 * Validates the customer making the request was granted access
 * to the Medical API.
 */
export async function checkMAPIAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const cxId = getCxIdOrFail(req);
    const hasMAPIAccess = await hasMapiAccess(cxId);
    if (hasMAPIAccess || Config.isSandbox()) {
      next();
      return;
    }
  } catch (error) {
    out().log(`Failed checking MAPI access with error ${error}`);
    res.sendStatus(status.INTERNAL_SERVER_ERROR);
    return;
  }
  res.sendStatus(status.FORBIDDEN);
  return;
}

function isValidCxId(cxId: string | undefined): cxId is string {
  return !!(cxId && cxId.trim().length >= 5);
}
