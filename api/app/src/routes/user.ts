import { User } from "@metriport/api";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { createConnectedUser } from "../command/connected-user/create-connected-user";
import { getConnectedUserOrFail } from "../command/connected-user/get-connected-user";
import { createUserToken } from "../command/cx-user/create-user-token";
import BadRequestError from "../errors/bad-request";
import { ConnectedUser } from "../models/connected-user";
import { Apple } from "../providers/apple";
import { ConsumerHealthDataType } from "../providers/provider";
import { Config } from "../shared/config";
import { Constants, providerOAuth2OptionsSchema, PROVIDER_APPLE } from "../shared/constants";
import { getProviderDataForType } from "./helpers/provider-route-helper";
import {
  asyncHandler,
  getCxIdOrFail,
  getUserIdFromQueryOrFail,
  getUserIdFromParamsOrFail,
} from "./util";

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
    const results = await getProviderDataForType<User>(req, ConsumerHealthDataType.User);

    res.status(status.OK).json(results);
  })
);

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
    if (!appUserId) {
      return res.sendStatus(status.BAD_REQUEST);
    }

    if (Config.isSandbox()) {
      // limit the amount of users that can be created in sandbox mode
      const numConnectedUsers = await ConnectedUser.count({ where: { cxId } });
      if (numConnectedUsers >= Config.SANDBOX_USER_LIMIT) {
        return res.sendStatus(status.BAD_REQUEST).json({
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
        cxId: req.cxId,
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
    // validate required query params
    if (!req.query.userId) {
      return res.sendStatus(status.BAD_REQUEST);
    }
    const userId = getUserIdFromQueryOrFail(req);
    const cxId = getCxIdOrFail(req);

    // check to make sure this user actually exists
    const connectedUser = await ConnectedUser.findOne({
      where: { id: userId, cxId },
    });
    if (connectedUser == null) {
      return res.sendStatus(status.BAD_REQUEST);
    }

    const userToken = await createUserToken({ cxId, userId });

    return res.status(status.OK).json({ token: userToken.token });
  })
);

/** ---------------------------------------------------------------------------------------
 * DELETE /user/revoke
 *
 * Revoke access to a provider
 *
 * @param   {string}  req.query.provider    The provider to revoke access.
 * @param   {string}  req.query.userId      The internal user ID.

 * @return  {{success: boolean}}      If successfully removed.
 */
router.delete(
  "/revoke",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserIdFromQueryOrFail(req);
    const cxId = getCxIdOrFail(req);
    const connectedUser = await getConnectedUserOrFail({ id: userId, cxId });

    const providerOAuth2 = providerOAuth2OptionsSchema.safeParse(req.query.provider);

    // TODO #249: implement garmin revoke support
    // const providerOAuth1 = providerOAuth1OptionsSchema.safeParse(
    //   req.query.provider
    // );

    if (providerOAuth2.success) {
      await Constants.PROVIDER_OAUTH2_MAP[providerOAuth2.data].revokeProviderAccess(connectedUser);

      return res.sendStatus(200);
      // } else if (providerOAuth1.success) {
      //   // await Constants.PROVIDER_OAUTH1_MAP[
      //   //   providerOAuth1.data
      //   // ].deregister(connectedUser);
    } else if (req.query.provider === PROVIDER_APPLE) {
      const apple = new Apple();
      await apple.revokeProviderAccess(connectedUser);
      return res.sendStatus(200);
    } else {
      throw new BadRequestError(`Provider not supported: ${req.query.provider}`);
    }
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
    const userId = getUserIdFromParamsOrFail(req);
    const cxId = getCxIdOrFail(req);
    const connectedUser = await getConnectedUserOrFail({ id: userId, cxId });

    if (connectedUser.providerMap) {
      const connectedProviders = Object.keys(connectedUser.providerMap).map(key => {
        return key;
      });
      return res.status(status.OK).json({ connectedProviders });
    } else {
      throw new BadRequestError(`User ${userId} has no provider map`);
    }
  })
);

/* /user/connect */
router.get("/connect", async (req: Request, res: Response) => {
  // TODO: get all users currently connected to the API to display on dev dash
  const users: [] = [];
  return res.status(status.OK).json(users);
});

export default router;
