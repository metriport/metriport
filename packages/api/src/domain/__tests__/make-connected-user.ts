import { ConnectedUser } from "../../models/connected-user";
import { ProviderSource } from "@metriport/api-sdk";

export function makeConnectedUser(
  userId: string,
  cxId: string,
  token: string
): Partial<ConnectedUser> {
  return {
    id: userId,
    cxId,
    providerMap: token
      ? {
          [ProviderSource.garmin]: {
            token,
          },
        }
      : {},
  };
}
