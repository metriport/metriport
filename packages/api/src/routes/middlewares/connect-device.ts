import { getConnectedUserOrFail } from "../../command/connected-user/get-connected-user";
import { updateProviderData } from "../../command/connected-user/save-connected-user";
import { getUserToken } from "../../command/cx-user/get-user-token";
import UnauthorizedError from "../../errors/unauthorized";
import { ConnectedUser } from "../../models/connected-user";
import { RPMDeviceProviderOptions } from "../../shared/constants";

/**
 * Connects the user to a provider that does not use OAuth1 or OAuth2.
 *
 * @param {RPMDeviceProviderOptions}      provider      A medical device provider (i.e. Tenovi)
 * @param {string}                        token         Connect Token
 * @param {string}                        deviceIds     Comma-separated string of device IDs
 * @param {string}                        deviceUserId  Device User ID
 * @returns
 */
export const connectDevice = async (
  provider: RPMDeviceProviderOptions,
  token: string,
  deviceIds: string,
  deviceUserId: string
): Promise<ConnectedUser> => {
  const userToken = await getUserToken({ token });
  const cxId = userToken.cxId;
  const userId = userToken.userId;

  if (!provider || !cxId || !userId) {
    throw new UnauthorizedError();
  }

  const connectedUser = await getConnectedUserOrFail({ id: userId, cxId });

  const connectedDeviceIds = getConnectedDeviceIds(connectedUser, provider, deviceIds);

  // save the access token in the provider map
  const updatedConnectedUser = await updateProviderData({
    id: userId,
    cxId,
    provider,
    providerItem: {
      token: "true",
      connectedDeviceIds,
      deviceUserId,
    },
  });

  return updatedConnectedUser;
};

/**
 * Gets the IDs of all connected devices for the user.
 *
 * @param connectedUser  Connected User
 * @param provider       A healthcare provider
 * @param deviceIds      A comma-separated string of devices IDs
 * @returns
 */
function getConnectedDeviceIds(
  connectedUser: ConnectedUser,
  provider: RPMDeviceProviderOptions,
  deviceIds: string
): string[] | undefined {
  if (connectedUser.providerMap) {
    const deviceIdList = deviceIds.split(",");
    const prevConnectedDevices = connectedUser.providerMap[provider]?.connectedDeviceIds;
    const connectedDevices = prevConnectedDevices
      ? [...prevConnectedDevices, ...deviceIdList]
      : deviceIdList;

    // TODO: If duplicates in the list, maybe let the user know it was already connected?
    return [...new Set(connectedDevices)];
  }
}
