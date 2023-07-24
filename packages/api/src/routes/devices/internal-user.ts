import { Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { asyncHandler } from "../util";
import {
  getAllConnectedUsers,
  getConnectedUserOrFail,
} from "../../command/connected-user/get-connected-user";
import { Constants, providerOAuth2OptionsSchema } from "../../shared/constants";
import { updateProviderData } from "../../command/connected-user/save-connected-user";
import { sendProviderDisconnected } from "../../command/webhook/devices";

const router = Router();

/** ---------------------------------------------------------------------------
 * POST /internal/user/refresh-tokens
 *
 * Attempts to refresh all users' tokens for each of their connected providers.
 * If the refresh doesn't work, this means that the token is invalid and can no
 * longer be used - in this case, the token will be revoked locally and a
 * webhook will be sent to the CX to notify them of the disconnect.
 *
 *
 * @return 200 OK
 */
router.post(
  "/refresh-tokens",
  asyncHandler(async (_, res: Response) => {
    const connectedUsers = await getAllConnectedUsers();
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
      const newConnectedUser = await getConnectedUserOrFail({
        cxId: connectedUser.cxId,
        id: connectedUser.id,
      });
      await sendProviderDisconnected(newConnectedUser, disconnectedProviders);
    }
    return res.status(status.OK);
  })
);

export default router;
