import NotFoundError from "../../errors/not-found";
import { ConnectedUser } from "../../models/connected-user";
import { ProviderOptions } from "../../shared/constants";
import { AtLeastOne } from "../../shared/types";

export const getConnectedUser = async ({
  id,
  cxId,
}: {
  id: string;
  cxId: string;
}): Promise<ConnectedUser | null> => {
  return ConnectedUser.findOne({
    where: { id, cxId },
  });
};

export const getConnectedUserOrFail = async ({
  id,
  cxId,
}: {
  id: string;
  cxId: string;
}): Promise<ConnectedUser> => {
  const connectedUser = await getConnectedUser({ id, cxId });
  if (!connectedUser)
    throw new NotFoundError(`Could not find connected user ${id} for customer ${cxId}`);
  return connectedUser;
};

export const getProviderDataFromConnectUserOrFail = (
  connectedUser: ConnectedUser,
  provider: ProviderOptions
) => {
  if (!connectedUser.providerMap) throw new NotFoundError();
  const providerData = connectedUser.providerMap[provider];
  if (!providerData) throw new NotFoundError();

  return providerData;
};

export const getConnectedUsers = async ({
  ids,
  cxId,
}: AtLeastOne<Pick<ConnectedUser, "cxId"> & { ids: ConnectedUser["id"][] }>): Promise<
  ConnectedUser[]
> => {
  return ConnectedUser.findAll({
    where: {
      ...(ids ? { id: ids } : undefined),
      cxId,
    },
  });
};

// {
//   "google": {
//       "token": "{\"access_token\":\"ya29.a0Ael9sCN33baX4EAXCNu5S-YXTSEMzk6nXmObAkDN4DuT3vjbG53hGRaRawEBCfxN9GrBitj8itLULwoLW5KaD0Xw0yquc4_hlgLzFWA1emaVEUMqcKCHsAwhBYoAzTtgHx8J7WG3A5JXbFHHgMzzVSTRhMlW_VOoaCgYKATESARISFQF4udJhm6tjDebOo13V-YKpQrGx-w0167\",\"expires_in\":3599,\"scope\":\"https://www.googleapis.com/auth/fitness.body.read https://www.googleapis.com/auth/fitness.blood_glucose.read https://www.googleapis.com/auth/fitness.location.read https://www.googleapis.com/auth/fitness.body_temperature.read https://www.googleapis.com/auth/fitness.nutrition.read https://www.googleapis.com/auth/fitness.heart_rate.read https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.blood_pressure.read https://www.googleapis.com/auth/fitness.oxygen_saturation.read https://www.googleapis.com/auth/fitness.sleep.read\",\"token_type\":\"Bearer\",\"expires_at\":\"2023-03-25T17:06:13.038Z\",\"refresh_token\":\"1//06lNjtK0C287TCgYIARAAGAYSNwF-L9Ir8lNG5iRG-m8nqCR--R338_8F5jEaKiTThShVd6jOpvU4EmLlEmkMqIg5rNW-GLqHSdU\"}"
//   },
//   "withings": {
//       "token": "{\"userid\":33686487,\"access_token\":\"7ad8cde2d17591cfd1285a7a9c3c67cabd40d077\",\"refresh_token\":\"dba253e7c44db665bf3bcd9fc796d456eba53872\",\"scope\":\"user.activity,user.metrics\",\"expires_in\":10800,\"token_type\":\"Bearer\",\"expires_at\":1679771174}"
//   }
// }
