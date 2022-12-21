import base64url from "base64url";
import { NextFunction, Request, Response } from "express";

/**
 * Process the API key and get the customer id.
 * The customer id is stored on the Request, property 'cxId'.
 */
export const processAPIKey = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // TODO: don't do anything in standalone mode
    // just trying to get the info, the auth is done on API GW
    // downstream routes should check whether `cxId` is present on the request or not
    const encodedApiKey = req.header("x-api-key") as string;
    const apiKey = base64url.decode(encodedApiKey);
    const splitApiKey = apiKey.split(":");
    req.cxId = splitApiKey[1];
  } catch (error) {
    // noop - auth is done on API GW level, this is just to make data available downstream
  }
  next();
};

