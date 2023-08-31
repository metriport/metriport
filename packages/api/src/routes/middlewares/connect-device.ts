import { getConnectedUserOrFail } from "../../command/connected-user/get-connected-user";
import { updateProviderData } from "../../command/connected-user/save-connected-user";
import { getUserToken } from "../../command/cx-user/get-user-token";
import UnauthorizedError from "../../errors/unauthorized";
import { ConnectedUser } from "../../models/connected-user";
import { TENOVI_DEFAULT_TOKEN_VALUE } from "../../providers/tenovi";
import { RPMDeviceProviderOptions } from "../../shared/constants";

/**
 * Stores user's rpm device IDs and user ID in the provider map.
 *
 * @param provider      A medical device provider (i.e. Tenovi)
 * @param token         Connect Token
 * @param deviceIds     A list of device IDs
 * @param deviceUserId  Device User ID
 * @returns
 */
export const saveRpmDevice = async (
  provider: RPMDeviceProviderOptions,
  token: string,
  deviceIds: string[],
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
      token: TENOVI_DEFAULT_TOKEN_VALUE,
      connectedDeviceIds,
      deviceUserId,
    },
  });

  return updatedConnectedUser;
};

/**
 * Merges and returns the IDs of all connected devices for the user.
 *
 * @param connectedUser  Connected User
 * @param provider       A healthcare provider
 * @param deviceIds      A list of device IDs
 * @returns
 */
function getConnectedDeviceIds(
  connectedUser: ConnectedUser,
  provider: RPMDeviceProviderOptions,
  deviceIds: string[]
): string[] {
  if (connectedUser.providerMap) {
    const prevConnectedDevices = connectedUser.providerMap[provider]?.connectedDeviceIds;
    const connectedDevices = prevConnectedDevices
      ? [...prevConnectedDevices, ...deviceIds]
      : deviceIds;

    // TODO: If duplicates in the list, maybe let the user know it was already connected?
    return [...new Set(connectedDevices)];
  }
  return deviceIds;
}
