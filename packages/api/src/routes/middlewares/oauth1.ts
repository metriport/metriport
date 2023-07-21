import z from "zod";
import { updateProviderData } from "../../command/connected-user/save-connected-user";
import { getUserToken } from "../../command/cx-user/get-user-token";
import UnauthorizedError from "../../errors/unauthorized";
import { ConnectedUser } from "../../models/connected-user";
import { Constants, PROVIDER_GARMIN, ProviderOAuth1Options } from "../../shared/constants";

export const processOAuth1 = async (
  provider: ProviderOAuth1Options,
  state: string,
  oauth_token: string | undefined,
  oauth_verifier: string | undefined
): Promise<ConnectedUser> => {
  const userToken = await getUserToken({ token: state });
  if (userToken.oauthRequestToken !== oauth_token) throw new UnauthorizedError();
  if (!oauth_verifier) throw new UnauthorizedError();

  // get access token/secret based on the provided userToken and oauth_verifier
  const providerDomain = Constants.PROVIDER_OAUTH1_MAP[provider];
  const { userAccessToken, userAccessTokenSecret } = await providerDomain.processStep2(
    userToken,
    oauth_verifier
  );

  // save the access token in the provider map
  const connectedUser = await updateProviderData({
    id: userToken.userId,
    cxId: userToken.cxId,
    provider,
    providerItem: {
      token: userAccessToken,
      secret: userAccessTokenSecret,
    },
  });

  return connectedUser;
};

export const deregisterUsersSchema = z.array(
  z.object({
    // userId: z.string(), // not being used
    userAccessToken: z.string(),
  })
);
type DeregisterUsers = z.infer<typeof deregisterUsersSchema>;
export async function deregister(users: DeregisterUsers): Promise<void> {
  const uatList = users.map(u => u.userAccessToken);
  await Constants.PROVIDER_OAUTH1_MAP[PROVIDER_GARMIN].deregister(uatList);
}
