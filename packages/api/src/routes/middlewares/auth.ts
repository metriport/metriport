import { base64ToString } from "@metriport/core/util/base64";
import { out } from "@metriport/core/util/log";
import { NextFunction, Request, Response } from "express";
import status from "http-status";
import * as jwt from "jsonwebtoken";
import { MAPIAccess } from "../../models/medical/mapi-access";
import { Config } from "../../shared/config";
import { getCxIdOrFail } from "../util";

/**
 * Process the API key and get the customer id.
 * The customer id is stored on the Request, property 'cxId'.
 */
export function processCxId(req: Request, res: Response, next: NextFunction): void {
  try {
    // Just gets the cxId from the API Key, the actual auth is done on API GW.
    // Downstream routes should check whether `cxId` is present on the request or not.
    const encodedApiKey = req.header("x-api-key");
    req.cxId = getCxIdFromApiKey(encodedApiKey);
    // TODO remove this
    // TODO remove this
    // TODO remove this
    // TODO remove this
    console.log(`..... cxId from API Key: ${req.cxId}`);
  } catch (error) {
    try {
      // TODO remove this
      // TODO remove this
      // TODO remove this
      // TODO remove this
      req.cxId = getCxIdFromJwt(req);
      console.log(`..... cxId from JWT: ${req.cxId} 🤘`);
    } catch (error) {
      // noop - auth is done on API GW level, this is just to make data available downstream
    }
  }
  next();
}

export function getCxIdFromApiKey(encodedApiKey: string | undefined): string {
  if (!encodedApiKey) throw new Error("No API Key provided");
  const apiKey = base64ToString(encodedApiKey);
  const splitApiKey = apiKey.split(":");
  if (splitApiKey.length !== 2) throw new Error("Invalid API Key format");
  const cxId = splitApiKey[1];
  if (!isValidCxId(cxId)) throw new Error("Invalid API Key format");
  return cxId;
}

export function getCxIdFromJwt(req: Request): string {
  const jwtStr = req.header("Authorization");
  if (!jwtStr) throw new Error("Missing token");
  const rawToken = jwt.decode(jwtStr);
  if (!rawToken) throw new Error("Invalid token");
  const token = (typeof rawToken === "string" ? JSON.parse(rawToken) : rawToken) as jwt.JwtPayload;
  const cxId = token["cognito:username"] ?? token["cxId"];
  if (!isValidCxId(cxId)) throw new Error("Invalid cxId");
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
  let hasMAPIAccess = false;
  try {
    const cxId = getCxIdOrFail(req);
    const mapiAccess = await MAPIAccess.findOne({ where: { id: cxId } });
    hasMAPIAccess = mapiAccess != null;
  } catch (error) {
    out().log(`Failed checking MAPI access with error ${error}`);
  }
  if (hasMAPIAccess || Config.isSandbox()) {
    next();
  } else {
    res.status(status.FORBIDDEN);
    res.end();
  }
}

function isValidCxId(cxId: string | undefined): cxId is string {
  return !!(cxId && cxId.trim().length >= 5);
}
