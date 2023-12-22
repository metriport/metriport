import { ConnectedUserInfo, User } from "@metriport/api-sdk";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { createConnectedUser } from "../command/connected-user/create-connected-user";
import { deleteConnectedUser } from "../command/connected-user/delete-connected-user";
import {
  getConnectedUserOrFail,
  getConnectedUsers,
} from "../command/connected-user/get-connected-user";
import { createUserToken } from "../command/cx-user/create-user-token";
import BadRequestError from "../errors/bad-request";
import NotFoundError from "../errors/not-found";
import { ConnectedUser } from "../models/connected-user";

import { ConsumerHealthDataType } from "../providers/provider";
import { Tenovi } from "../providers/tenovi";
import { Config } from "../shared/config";
import {
  Constants,
  providerNoAuthSchema,
  providerOAuth1OptionsSchema,
  providerOAuth2OptionsSchema,
  PROVIDER_TENOVI,
} from "../shared/constants";
import { capture } from "@metriport/core/util/capture";
import { getRawParams, RawParams } from "../shared/raw-params";
import { getProviderDataForType } from "./helpers/provider-route-helper";
import { getUserIdFrom } from "./schemas/user-id";
import { asyncHandler, getCxIdOrFail, getFrom } from "./util";

const router = Router();

/** ---------------------------------------------------------------------------
 * GET /user
 *
 * Gets user data for all connected providers for the specified user ID
 * and date.
 *
 * @param   {string}        req.query.userId  The user ID.
 * @param   {string}        req.query.date    Date to fetch data for.
 *
 * @return  {User[]}   The user's info data.
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    let results;
    if (Object.keys(req.query).length == 0) {
      const connectedUsers = await listConnectedUsers(req);
      results = { connectedUsers };
    } else {
      results = await getProviderDataForType<User>(req, ConsumerHealthDataType.User);
    }

    res.status(status.OK).json(results);
  })
);

/**
 * Returns a list of all users and their providers for the client using cxId.
 *
 * @param {Request}   req    Request for the `/user` endpoint.
 *
 * @returns {ConnectedUserInfo[]}
 */
async function listConnectedUsers(req: Request): Promise<ConnectedUserInfo[]> {
  const cxId = getCxIdOrFail(req);
  const results = await getConnectedUsers({ cxId });
  const connectedUsers = await Promise.all(
    results.map(async user => {
      let connectedProviders;
      const userInfo: ConnectedUserInfo = {
        metriportUserId: user.id,
        appUserId: user.cxUserId,
      };
      if (user.providerMap) {
        connectedProviders = Object.keys(user.providerMap).map((key: string) => {
          return key;
        });
        userInfo.connectedProviders = connectedProviders;
      }
      return userInfo;
    })
  );

  return connectedUsers;
}

/** ---------------------------------------------------------------------------
 * POST /user
 *
 * Returns the internal user ID associated with the customer's user's ID.
 *
 * @param   {string}            req.query.appUserId  The customer's user ID.
 *
 * @return  {{userId: string}}  The associated internal user ID.
 */
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    // validate required query params
    const cxId = getCxIdOrFail(req);
    const appUserId = req.query.appUserId as string;
    if (!appUserId) throw new BadRequestError();

    if (Config.isSandbox()) {
      // limit the amount of users that can be created in sandbox mode
      const numConnectedUsers = await ConnectedUser.count({ where: { cxId } });
      if (numConnectedUsers >= Config.SANDBOX_USER_LIMIT) {
        return res.status(status.BAD_REQUEST).json({
          message: `Cannot connect more than ${Config.SANDBOX_USER_LIMIT} users in Sandbox mode!`,
        });
      }
    }
    // check to make sure this user hasn't already been created
    let connectedUser = await ConnectedUser.findOne({
      where: { cxId, cxUserId: appUserId },
    });

    // if the user doesn't yet exist, create one
    if (connectedUser == null) {
      connectedUser = await createConnectedUser({
        cxId,
        cxUserId: appUserId,
      });
    }

    // return the user ID associated with the customer's user
    return res.status(status.OK).json({ userId: connectedUser.id });
  })
);

/** ---------------------------------------------------------------------------
 * GET /user/connect/token
 *
 * Generates an auth token to be used for a connect widget session for the
 * specified user ID.
 *
 * @param   {string}            req.query.userId  The internal user ID.
 *
 * @return  {{token: string}}   The generated token.
 */
router.get(
  "/connect/token",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserIdFrom("query", req).orFail();
    const cxId = getCxIdOrFail(req);

    // check to make sure this user actually exists
    const connectedUser = await ConnectedUser.findOne({
      where: { id: userId, cxId },
    });
    if (connectedUser == null) throw new NotFoundError("User not found");

    const userToken = await createUserToken({ cxId, userId });

    return res.status(status.OK).json({ token: userToken.token });
  })
);

async function revokeUserProviderAccess(
  connectedUser: ConnectedUser,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provider: any,
  req: Request
): Promise<void> {
  const providerOAuth2 = providerOAuth2OptionsSchema.safeParse(provider);
  const providerOAuth1 = providerOAuth1OptionsSchema.safeParse(provider);
  const providerNoAuth = providerNoAuthSchema.safeParse(provider);

  if (providerOAuth2.success) {
    await Constants.PROVIDER_OAUTH2_MAP[providerOAuth2.data].revokeProviderAccess(connectedUser);
  } else if (providerOAuth1.success) {
    const token = connectedUser.dataValues.providerMap?.garmin?.token;
    const cxId = connectedUser.dataValues.cxId;
    if (token) await Constants.PROVIDER_OAUTH1_MAP[providerOAuth1.data].deregister([token], cxId);
  } else if (providerNoAuth.success) {
    const rawParams = getRawParams(req);
    const noAuthProvider = new Constants.noAuthProviders[providerNoAuth.data]();
    await noAuthProvider.revokeProviderAccess(connectedUser, rawParams);
  } else {
    throw new BadRequestError(`Provider not supported: ${provider}`);
  }
}

async function revokeToken(req: Request, res: Response, userId: string) {
  const cxId = getCxIdOrFail(req);
  const connectedUser = await getConnectedUserOrFail({ id: userId, cxId });
  await revokeUserProviderAccess(connectedUser, req.query.provider, req);
  return res
    .status(status.OK)
    .json({ message: `Access token for ${req.query.provider} has been revoked.` });
}

/** ---------------------------------------------------------------------------------------
 * DELETE /user/:userId/revoke
*
* Revoke access to a provider
*
* @param   {string}  req.query.provider    The provider to revoke access.
* @param   {string}  req.params.userId      The internal user ID.

* @return  {{success: boolean}}      If successfully removed.
*/
router.delete(
  "/:userId/revoke",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserIdFrom("params", req).orFail();
    return revokeToken(req, res, userId);
  })
);

/**
 * @deprecated use /:id/revoke instead.
 *
 * DELETE /user/revoke
 *
 * Revoke access to a provider
 *
 * @param   {string}  req.query.provider    The provider to revoke access.
 * @param   {string}  req.query.userId      The internal user ID.
 *
 * @return  {{success: boolean}}      If successfully removed.
 */
router.delete(
  "/revoke",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserIdFrom("query", req).orFail();
    return revokeToken(req, res, userId);
  })
);

/**
 * DELETE /user/delete
 *
 * Revoke access to all providers and permanently delete the user
 *
 * @param {string} req.params.userId      The internal user ID.
 *
 * @return  {{success: boolean}}      If successfully removed.
 */
router.delete(
  "/:userId",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserIdFrom("params", req).orFail();
    const cxId = getCxIdOrFail(req);
    const connectedUser = await getConnectedUserOrFail({ id: userId, cxId });

    if (connectedUser.providerMap) {
      const connectedProviders = Object.keys(connectedUser.providerMap).map(key => {
        return key;
      });
      const rejected: { provider: string; err: unknown }[] = [];
      await Promise.allSettled(
        connectedProviders.map(async provider => {
          return revokeUserProviderAccess(connectedUser, provider, req).catch(err => {
            rejected.push({ provider, err });
            throw err;
          });
        })
      );
      if (rejected.length > 0) {
        console.log(`Failed to revoke access to providers`, userId, rejected);
        capture.message(`Failed to revoke access to providers`, {
          extra: { rejected, userId },
        });
      }
    }

    await deleteConnectedUser(userId);

    return res.status(status.OK).json({ message: "User deleted successfully." });
  })
);

/** ---------------------------------------------------------------------------------------
 * GET /user/:userId/connected-providers
 *
 * Get the user's connected providers
 *
 * @param   {string}  req.params.userId      The internal user ID.

 * @return  {{connectedProviders: string[]}}   Array of connected providers
 */
router.get(
  "/:userId/connected-providers",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserIdFrom("params", req).orFail();
    const cxId = getCxIdOrFail(req);
    const connectedUser = await getConnectedUserOrFail({ id: userId, cxId });
    let connectedProviders: string[] = [];
    if (connectedUser.providerMap) {
      connectedProviders = Object.keys(connectedUser.providerMap).map(key => {
        return key;
      });
    }
    return res.status(status.OK).json({ connectedProviders });
  })
);

/* /user/connect */
router.get("/connect", async (req: Request, res: Response) => {
  // TODO: get all users currently connected to the API to display on dev dash
  const users: [] = [];
  return res.status(status.OK).json(users);
});

/**
 * Removes the device from the user's profile.
 *
 * @param connectedUser The user to disconnect the device from
 * @param provider      The device provider
 * @param deviceId      The device to disconnect
 * @param rawParams     The extra parameters required to disconnect the device
 */
async function removeDevice(
  connectedUser: ConnectedUser,
  provider: string,
  deviceId: string,
  rawParams: RawParams
) {
  if (provider === PROVIDER_TENOVI) {
    const tenovi = new Tenovi();
    await tenovi.disconnectDevice(connectedUser, String(deviceId), true, rawParams);
  } else {
    throw new BadRequestError(`Provider not supported: ${provider}`);
  }
}

/** ---------------------------------------------------------------------------------------
* DELETE /user/:userId/device
*
* Removes the specified device from the user's profile.
*
* @param   {string}  req.params.userId     The internal user ID.
* @param   {string}  req.query.provider    The device provider.
* @param   {string}  req.query.deviceId    The device ID to disconnect.

* @return  {{success: boolean}}      If successfully removed.
*/
router.delete(
  "/:userId/device",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserIdFrom("params", req).orFail();
    const cxId = getCxIdOrFail(req);
    const connectedUser = await getConnectedUserOrFail({ id: userId, cxId });

    const provider = getFrom("query").orFail("provider", req);
    const deviceId = getFrom("query").orFail("deviceId", req);

    const rawParams = getRawParams(req);

    await removeDevice(connectedUser, provider, deviceId, rawParams);
    return res
      .status(status.OK)
      .json({ message: `Device ${deviceId} has been removed for user ${userId}.` });
  })
);

export default router;
