import { base64ToString } from "@metriport/core/util/base64";
import { out } from "@metriport/core/util/log";
import { NextFunction, Request, Response } from "express";
import status from "http-status";
import * as jwt from "jsonwebtoken";
import { MAPIAccess } from "../../models/medical/mapi-access";
import { Config } from "../../shared/config";
import { getCxIdOrFail } from "../util";
import { getAuth, getCxId, PropelAuth } from "./propelauth";

/**
 * Process the API key and get the customer id.
 * The customer id is stored on the Request, property 'cxId'.
 */
export async function processCxId(req: Request, res: Response, next: NextFunction): Promise<void> {
  // validate it has the needed info
  const auth = getAuth();
  const { log } = out("processCxId");
  try {
    // Just gets the cxId from the API Key, the actual auth is done on API GW.
    // Downstream routes should check whether `cxId` is present on the request or not.
    const encodedApiKey = req.header("x-api-key");
    req.cxId = getCxIdFromApiKey(encodedApiKey);
  } catch (error) {
    try {
      // TODO 1986 Remove this after we're fully off of Cognito
      req.cxId = getCxIdFromCognitoJwt(req);
      log(`Cognito - cxId ${req.cxId}`);
    } catch (error) {
      try {
        // TODO 1986 Remove the conditional after we're fully off of Cognito
        if (auth) {
          req.cxId = await getCxIdFromJwt(req, auth);
          log(`PropelAuth - cxId ${req.cxId}`);
        }
      } catch (error) {
        // noop - auth is done on API GW level, this is just to make data available downstream
      }
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

export async function getCxIdFromJwt(req: Request, auth: PropelAuth): Promise<string> {
  const jwtStr = req.header("Authorization");
  if (!jwtStr) throw new Error("Missing token");
  const user = await auth.validateAccessTokenAndGetUser(jwtStr);
  const cxId = getCxId(user);
  if (!cxId) throw new Error("Could not determine cxId from JWT");
  return cxId;
}

// TODO 1935 1986 Remove this after we're fully off of Cognito
export function getCxIdFromCognitoJwt(req: Request): string {
  const jwtStr = req.header("Authorization");
  if (!jwtStr) throw new Error("Missing token");
  const rawToken = jwt.decode(jwtStr);
  if (!rawToken) throw new Error("Invalid token");
  const token = (typeof rawToken === "string" ? JSON.parse(rawToken) : rawToken) as jwt.JwtPayload;
  const cxId = token["name"] ?? token["sub"];
  if (!isValidCxId(cxId)) throw new Error("Invalid cxId");
  console.log(`Got cxId from Cognito JWT ${cxId}`);
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
