import { updateProviderData } from "../../command/connected-user/save-connected-user";
import { getUserToken } from "../../command/cx-user/get-user-token";
import UnauthorizedError from "../../errors/unauthorized";
import { ConnectedUser } from "../../models/connected-user";
import { Config } from "../../shared/config";
import { Constants, ProviderOAuth2Options } from "../../shared/constants";

export const processOAuth2 = async (
  provider: ProviderOAuth2Options,
  state: string,
  authCode: string | undefined,
  cxId: string | undefined,
  userId: string | undefined
): Promise<ConnectedUser> => {
  // get the cx/user ids from DDB if this isn't cloud mode
  if (!Config.isCloudEnv()) {
    const useToken = await getUserToken({ token: state });
    cxId = useToken.cxId;
    userId = useToken.userId;
  }
  if (!provider || !authCode || !cxId || !userId) {
    throw new UnauthorizedError();
  }
  // get access token based on the provided auth code
  const token = await Constants.PROVIDER_OAUTH2_MAP[provider].getTokenFromAuthCode(authCode);
  if (!token) throw new UnauthorizedError();

  // save the access token in the provider map
  const connectedUser = await updateProviderData({
    id: userId,
    cxId,
    provider,
    providerItem: {
      token: token,
    },
  });

  Constants.PROVIDER_OAUTH2_MAP[provider].postAuth?.(token, connectedUser);

  return connectedUser;
};
