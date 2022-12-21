import { User } from "@metriport/api";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { createConnectedUser } from "../command/connected-user/create-connected-user";
import { createUserToken } from "../command/cx-user/create-user-token";
import { ConnectedUser } from "../models/connected-user";
import { ConsumerHealthDataType } from "../providers/provider";
import { Config } from "../shared/config";
import { getProviderDataForType } from "./helpers/provider-route-helper";
import { asyncHandler, getCxIdOrFail, getUserIdOrFail } from "./util";

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
    const results = await getProviderDataForType<User>(
      req,
      ConsumerHealthDataType.User
    );

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
      let numConnectedUsers = await ConnectedUser.count({ where: { cxId } });
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
    const userId = getUserIdOrFail(req);
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

/* /user/connect */
router.get("/connect", async (req: Request, res: Response) => {
  // TODO: get all users currently connected to the API to display on dev dash
  const users: [] = [];
  return res.status(status.OK).json(users);
});

export default router;
