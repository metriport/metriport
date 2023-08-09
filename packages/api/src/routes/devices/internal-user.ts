import { ProviderSource } from "@metriport/api-sdk";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import {
  getAllConnectedUsers,
  getConnectedUserOrFail,
} from "../../command/connected-user/get-connected-user";
import { updateProviderData } from "../../command/connected-user/save-connected-user";
import { sendProviderDisconnected } from "../../command/webhook/devices";
import { Constants, providerOAuth2OptionsSchema } from "../../shared/constants";
import { getUUIDFrom } from "../schemas/uuid";
import { asyncHandler } from "../util";

const router = Router();

/** ---------------------------------------------------------------------------
 * POST /internal/user/refresh-tokens
 *
 * Attempts to refresh all users' tokens for each of their connected providers.
 * If the refresh doesn't work, this means that the token is invalid and can no
 * longer be used - in this case, the token will be revoked locally and a
 * webhook will be sent to the CX to notify them of the disconnect.
 *
 * @param req.query.cxId - (Optional) the customer/account's ID.
 * @return Count of users processed and count of users with disconnected providers.
 */
router.post(
  "/refresh-tokens",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").optional();
    const connectedUsers = await getAllConnectedUsers(cxId);
    let disconnectCount = 0;
    for (const connectedUser of connectedUsers) {
      const providers = connectedUser.providerMap ? Object.keys(connectedUser.providerMap) : [];
      const disconnectedProviders: string[] = [];
      for (const providerStr of providers) {
        const providerOAuth2Type = providerOAuth2OptionsSchema.safeParse(providerStr);
        if (providerOAuth2Type.success) {
          const providerOAuth2 = Constants.PROVIDER_OAUTH2_MAP[providerOAuth2Type.data];
          try {
            await providerOAuth2.getAccessToken(connectedUser);
          } catch (error) {
            await updateProviderData({
              id: connectedUser.id,
              cxId: connectedUser.cxId,
              provider: providerOAuth2Type.data,
              providerItem: undefined,
            });
            disconnectedProviders.push(providerStr);
          }
        }
      }
      if (disconnectedProviders.length > 0) {
        const newConnectedUser = await getConnectedUserOrFail({
          cxId: connectedUser.cxId,
          id: connectedUser.id,
        });
        sendProviderDisconnected(newConnectedUser, disconnectedProviders);
        disconnectCount++;
      }
    }
    return res.status(status.OK).json({
      usersProcessed: connectedUsers.length,
      usersWithDisconnectedProviders: disconnectCount,
    });
  })
);

/** ---------------------------------------------------------------------------
 * POST /internal/user/resubscribe-fitbit-webhooks
 *
 * Finds all existing users that are connected to Fitbit and recreates their webhook subscriptions.
 *
 * @param req.query.cxId - (Optional) the customer/account's ID.
 * @return Count of users processed and count of users with disconnected providers.
 */
router.post(
  "/resubscribe-fitbit-webhooks",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").optional();
    const connectedUsers = await getAllConnectedUsers(cxId);

    let usersAffected = 0;
    const errorsCaught: { count: number; errors: unknown[] } = {
      count: 0,
      errors: [],
    };
    for (const connectedUser of connectedUsers) {
      const providers = connectedUser.providerMap ? Object.keys(connectedUser.providerMap) : [];
      for (const providerStr of providers) {
        if (providerStr === ProviderSource.fitbit) {
          const providerOAuth2Type = providerOAuth2OptionsSchema.safeParse(providerStr);
          if (providerOAuth2Type.success) {
            try {
              const fitbitToken = connectedUser.providerMap?.fitbit?.token;
              if (fitbitToken) {
                await Constants.PROVIDER_OAUTH2_MAP[ProviderSource.fitbit].postAuth?.(
                  fitbitToken,
                  connectedUser,
                  true
                );
                usersAffected++;
              }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (err: any) {
              errorsCaught.count++;
              errorsCaught.errors.push(err.rejected ? err.rejected : err);
              console.log(
                `Failed to add webhook subscriptions through the internal user route. User: ${connectedUser.id}, CX: ${connectedUser.cxId}, Error: ${err}.`
              );
            }
          }
        }
      }
    }
    return res.status(status.OK).json({
      usersProcessed: connectedUsers.length,
      usersAffected,
      errorsCaught,
    });
  })
);

export default router;
