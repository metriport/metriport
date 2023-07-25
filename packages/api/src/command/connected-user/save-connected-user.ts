import { ConnectedUser, ProviderMapItem } from "../../models/connected-user";
import { ProviderOptions } from "../../shared/constants";
import { getConnectedUserOrFail } from "./get-connected-user";

export const updateProviderData = async ({
  id,
  cxId,
  provider,
  providerItem,
}: {
  id: string;
  cxId: string;
  provider: ProviderOptions;
  providerItem?: ProviderMapItem;
}): Promise<ConnectedUser> => {
  const connectedUser = await getConnectedUserOrFail({ id, cxId });
  const newItem = { [provider]: providerItem };
  const newProviderMap = connectedUser.providerMap
    ? { ...connectedUser.providerMap, ...newItem }
    : { ...newItem };
  connectedUser.providerMap = newProviderMap;
  await ConnectedUser.update({ providerMap: newProviderMap }, { where: { id, cxId } });
  return getConnectedUserOrFail({ id, cxId });
};
