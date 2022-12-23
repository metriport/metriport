import { NextFunction, Request, Response } from "express";

import { ConnectedUser } from "../models/connected-user";
import { ProviderOptions } from "../shared/constants";
import BadRequestError from "../errors/bad-request";
import UnauthorizedError from "../errors/unauthorized";

export const asyncHandler =
  (
    f: (
      req: Request,
      res: Response,
      next: NextFunction
    ) => Promise<Response<any, Record<string, any>> | void>
  ) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await f(req, res, next);
    } catch (err) {
      console.error(err);
      next(err);
    }
  };

export const getCxId = (req: Request): string | undefined => req.cxId;
export const getCxIdOrFail = (req: Request): string => {
  const cxId = getCxId(req);
  if (!cxId) throw new BadRequestError("Missing cxId");
  return cxId;
};

export const getCxIdFromQuery = (req: Request): string | undefined =>
  req.query.cxId as string | undefined;
export const getCxIdFromQueryOrFail = (req: Request): string => {
  const cxId = getCxIdFromQuery(req);
  if (!cxId) throw new BadRequestError("Missing cxId query param");
  return cxId;
};

export const getCxIdFromHeaders = (req: Request): string | undefined =>
  req.header("cxId") as string | undefined;

export const getUserIdFromHeaders = (req: Request): string | undefined =>
  req.header("userId") as string | undefined;
export const getUserId = (req: Request): string | undefined =>
  req.query.userId as string | undefined;
export const getUserIdFromQueryOrFail = (req: Request): string => {
  const userId = getUserId(req);
  if (!userId) throw new BadRequestError("Missing userId query param");
  return userId as string;
};

export const getProviderMapFromConnectUserOrFail = (connectedUser: ConnectedUser, provider: ProviderOptions) => {
  if (!connectedUser.providerMap) throw new UnauthorizedError();
  const providerData = connectedUser.providerMap[provider];
  if (!providerData) throw new UnauthorizedError();

  return providerData;
}

export const getDate = (req: Request): string | undefined =>
  req.query.date as string | undefined;
export const getDateOrFail = (req: Request): string => {
  const date = getDate(req);
  if (!date) throw new BadRequestError("Missing date query param");
  return date as string;
};

export const getCustomerEmail = (req: Request): string | undefined => req.email;
export const getCustomerEmailOrFail = (req: Request): string => {
  const email = getCustomerEmail(req);
  if (!email) throw new BadRequestError("Missing email");
  return email;
};
