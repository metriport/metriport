import Provider, { ConsumerHealthDataType } from "./provider";
import { updateProviderData } from "../command/connected-user/save-connected-user";
import { ConnectedUser } from "../models/connected-user";
import { PROVIDER_APPLE } from "../shared/constants";
import { NoAuth } from "./shared/noauth";

export class Apple extends Provider implements NoAuth {
  constructor() {
    super({
      // All disabled for synchronous mode
      [ConsumerHealthDataType.Activity]: false,
      [ConsumerHealthDataType.Body]: false,
      [ConsumerHealthDataType.Biometrics]: false,
      [ConsumerHealthDataType.Nutrition]: false,
      [ConsumerHealthDataType.Sleep]: false,
      [ConsumerHealthDataType.User]: false,
    });
  }

  async revokeProviderAccess(connectedUser: ConnectedUser): Promise<void> {
    await updateProviderData({
      id: connectedUser.id,
      cxId: connectedUser.cxId,
      provider: PROVIDER_APPLE,
      providerItem: undefined,
    });
  }
}
