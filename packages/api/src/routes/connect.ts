import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import z from "zod";
import { getConnectedUserOrFail } from "../command/connected-user/get-connected-user";
import { updateProviderData } from "../command/connected-user/save-connected-user";
import { getUserToken } from "../command/cx-user/get-user-token";
import { sendProviderConnected } from "../command/webhook/devices";
import BadRequestError from "../errors/bad-request";
import UnauthorizedError from "../errors/unauthorized";
import { Config } from "../shared/config";
import {
  Constants,
  PROVIDER_APPLE,
  providerOAuth1OptionsSchema,
  providerOAuth2OptionsSchema,
  rpmDeviceProviderSchema,
} from "../shared/constants";
import { saveRpmDevice } from "./middlewares/connect-device";
import { processOAuth1 } from "./middlewares/oauth1";
import { processOAuth2 } from "./middlewares/oauth2";
import { getUserIdFrom } from "./schemas/user-id";
import { asyncHandler, getCxIdFromHeaders } from "./util";

const router = Router();

/** ---------------------------------------------------------------------------
 * Builds the success or error connect widget redirect URL based on the
 * specified session token.
 *
 * @param     {string}  success   True if the request was successful; false
 *                                otherwise.
 * @param     {string}  token     The connect widget's session token.
 * @returns   {string}  The connect error redirect URL.
 */
export const buildRedirectURL = (success: boolean, token: string): string => {
  const redirectPath = success ? "success" : "error";
  const sandboxFlag = Config.isSandbox() ? "&sandbox=true" : "";
  return `${Config.getConnectWidgetUrl()}${redirectPath}?token=${token}${sandboxFlag}`;
};

/** ---------------------------------------------------------------------------------------
 * GET /connect/redirect
 *
 * Generates the auth url for the specified provider & token.
 *
 * @param   {string}  req.query.provider    The provider to get the redirect for.
 * @param   {string}  req.header.api-token  The auth token.
 *
 * @return  {{token: string}}   The generated token.
 */
router.get(
  "/redirect",
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.header("api-token");
    if (!token) throw new UnauthorizedError();

    const providerOAuth2 = providerOAuth2OptionsSchema.safeParse(req.query.provider);
    if (providerOAuth2.success) {
      const providerUrl = await Constants.PROVIDER_OAUTH2_MAP[providerOAuth2.data].getAuthUri(
        token
      );
      return res.send(providerUrl);
    }

    const providerOAuth1 = providerOAuth1OptionsSchema.safeParse(req.query.provider);
    if (providerOAuth1.success) {
      const providerUrl = await Constants.PROVIDER_OAUTH1_MAP[providerOAuth1.data].processStep1(
        token
      );
      return res.send(providerUrl);
    }

    throw new BadRequestError(`Provider not supported: ${req.query.provider}`);
  })
);

const providerRequest = z.object({
  state: z.string(),
  // OAuth v2
  code: z.string().optional(),
  // OAuth v1
  oauth_token: z.string().optional(),
  oauth_verifier: z.string().optional(),
});

/** ---------------------------------------------------------------------------------------
 * GET /connect/:provider
 *
 * Gets and stores the auth token for the specified provider for future requests. If all is
 * well, will redirect to the Success page in the Connect widget.
 *
 * @param   {string}   req.params.provider       The provider for the request.
 * @param   {string}   req.query.state           The connect token.
 * @param   {string}   req.query.authCode        The OAuth v2 authorization code.
 * @param   {string}   req.query.oauth_token     The OAuth v1 request token.
 * @param   {string}   req.query.oauth_verifier  The OAuth v1 request token verifier.
 *
 * @return  redirect to the Success page.
 */
router.get(
  "/:provider",
  asyncHandler(async (req: Request, res: Response) => {
    const {
      state: connectToken,
      code: authCode,
      oauth_token,
      oauth_verifier,
    } = providerRequest.parse(req.query);

    try {
      // OAUTH 2
      const providerOAuth2 = providerOAuth2OptionsSchema.safeParse(req.params.provider);
      if (providerOAuth2.success) {
        const provider = providerOAuth2.data;
        const cxId = getCxIdFromHeaders(req);
        const userId = getUserIdFrom("headers", req).optional();

        const connectedUser = await processOAuth2(provider, connectToken, authCode, cxId, userId);
        sendProviderConnected(connectedUser, provider);
        return res.redirect(`${buildRedirectURL(true, connectToken)}`);
      }

      // OAUTH 1
      const providerOAuth1 = providerOAuth1OptionsSchema.safeParse(req.params.provider);
      if (providerOAuth1.success) {
        const provider = providerOAuth1.data;
        const connectedUser = await processOAuth1(
          provider,
          connectToken,
          oauth_token,
          oauth_verifier
        );
        sendProviderConnected(connectedUser, provider);
        return res.redirect(`${buildRedirectURL(true, connectToken)}`);
      }
    } catch (err) {
      console.log(`Error on /connect/${req.params.provider}`, err);
      return res.redirect(buildRedirectURL(false, connectToken));
    }
  })
);

const rpmProviderRequest = z.object({
  token: z.string(),
  deviceIds: z.string(),
  deviceUserId: z.string(),
});

/** ---------------------------------------------------------------------------------------
 * POST /connect/rpm/:provider
 *
 * Connects the user to the specified RPM device provider and stores their specified device ID(s).
 *
 * @param   {string}   req.params.provider       The provider for the request.
 * @param   {string}   req.query.token           The connect token.
 * @param   {string}   req.query.deviceIds       A comma-separated string of device IDs to be connected.
 * @param   {string}   req.query.deviceUserId    The ID of a device user (patient ID, for some providers)
 *
 */
router.post(
  "/rpm/:provider",
  asyncHandler(async (req: Request, res: Response) => {
    const { token, deviceIds, deviceUserId } = rpmProviderRequest.parse(req.query);

    // RPM DEVICES
    const provider = rpmDeviceProviderSchema.parse(req.params.provider);
    const deviceIdList = deviceIds.split(",");

    const connectedUser = await saveRpmDevice(provider, token, deviceIdList, deviceUserId);

    sendProviderConnected(connectedUser, provider, deviceIdList);
    return res.sendStatus(status.OK);
  })
);

/** ---------------------------------------------------------------------------------------
 * GET /connect/user/providers
 *
 * Fetches a user's providers
 *
 * @param   {string}  req.header.api-token  The auth token.
 * @param   {string}  req.header.cxId  Passed via headers from the /token auth lambda.
 * @param   {string}  req.header.userId  Passed via headers from the /token auth lambda.
 *
 * @return  {string[]}  The user's connected providers
 */
router.get(
  "/user/providers",
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.header("api-token");
    if (!token) throw new UnauthorizedError();

    let cxId;
    let userId;

    if (!Config.isCloudEnv()) {
      const useToken = await getUserToken({ token });
      cxId = useToken.cxId;
      userId = useToken.userId;
    } else {
      cxId = getCxIdFromHeaders(req);
      userId = getUserIdFrom("headers", req).optional();
    }

    if (!cxId || !userId) {
      throw new BadRequestError("Invalid headers");
    }

    const connectedUser = await getConnectedUserOrFail({ id: userId, cxId });
    if (!connectedUser.providerMap) return res.status(status.OK).send([]);

    const providers = Object.keys(connectedUser.providerMap);

    return res.status(status.OK).send(providers);
  })
);

/** ---------------------------------------------------------------------------------------
 * GET /connect/user/apple
 *
 * Add apple to the provider map and return metriportUserId
 *
 * @param   {string}  req.header.cxId  Passed via headers from the /token auth lambda.
 * @param   {string}  req.header.userId  Passed via headers from the /token auth lambda.
 *
 * @return  {string[]}  The user's connected providers
 */
router.get(
  "/user/apple",
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.header("api-token");
    if (!token) throw new UnauthorizedError();

    let cxId;
    let userId;

    if (!Config.isCloudEnv()) {
      const useToken = await getUserToken({ token });
      cxId = useToken.cxId;
      userId = useToken.userId;
    } else {
      cxId = getCxIdFromHeaders(req);
      userId = getUserIdFrom("headers", req).optional();
    }

    if (!cxId || !userId) {
      throw new BadRequestError("Invalid headers");
    }

    const connectedUser = await getConnectedUserOrFail({ id: userId, cxId });

    await updateProviderData({
      id: connectedUser.id,
      cxId: connectedUser.cxId,
      provider: PROVIDER_APPLE,
      providerItem: {
        token: "true",
      },
    });

    sendProviderConnected(connectedUser, PROVIDER_APPLE);
    return res.status(status.OK).send(connectedUser.id);
  })
);

export default router;
