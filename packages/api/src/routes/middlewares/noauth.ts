import { getConnectedUserOrFail } from "../../command/connected-user/get-connected-user";
import { updateProviderData } from "../../command/connected-user/save-connected-user";
import { getUserToken } from "../../command/cx-user/get-user-token";
import UnauthorizedError from "../../errors/unauthorized";
import { ConnectedUser } from "../../models/connected-user";
import { Config } from "../../shared/config";
import { ProviderMedicalDevicesOptions } from "../../shared/constants";

/**
 * Connects the user to a provider that does not use OAuth1 or OAuth2.
 *
 * @param {ProviderMedicalDevicesOptions} provider  A medical device provider (i.e. Tenovi)
 * @param {string}                        token     Connect Token
 * @param {string}                        deviceId  Comma-separated string of device IDs
 * @returns
 */
export const processNoAuth = async (
  provider: ProviderMedicalDevicesOptions,
  token: string,
  deviceId: string
): Promise<ConnectedUser> => {
  // get the cx/user ids from DDB if this isn't cloud mode
  let userToken;
  let cxId;
  let userId;

  if (!Config.isCloudEnv()) {
    userToken = await getUserToken({ token });
    cxId = userToken.cxId;
    userId = userToken.userId;
  }

  if (!provider || !cxId || !userId) {
    throw new UnauthorizedError();
  }

  const connectedUser = await getConnectedUserOrFail({ id: userId, cxId });

  const connectedDeviceIds = getConnectedDeviceIds(connectedUser, provider, deviceId);

  // save the access token in the provider map
  const updatedConnectedUser = await updateProviderData({
    id: userId,
    cxId,
    provider,
    providerItem: {
      token: "true",
      connectedDeviceIds,
    },
  });

  return updatedConnectedUser;
};

function getConnectedDeviceIds(
  connectedUser: ConnectedUser,
  provider: ProviderMedicalDevicesOptions,
  deviceId: string
): string[] | undefined {
  if (connectedUser.providerMap && provider in connectedUser.providerMap) {
    const device_ids_list = deviceId.split(",");
    const prevConnectedDevices = connectedUser.providerMap[provider]?.connectedDeviceIds;
    const connectedDevices = prevConnectedDevices
      ? [...prevConnectedDevices, ...device_ids_list]
      : device_ids_list;

    // TODO: If duplicates in the list, maybe let the user know it was already connected?
    return [...new Set(connectedDevices)];
  }
}
