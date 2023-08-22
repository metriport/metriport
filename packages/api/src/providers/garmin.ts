import { UserToken } from "../domain/user-token";
import { Config } from "../shared/config";
import { PROVIDER_GARMIN } from "../shared/constants";
import { OAuth1, OAuth1DefaultImpl } from "./shared/oauth1";
import Provider, { ConsumerHealthDataType } from "./provider";

export class Garmin extends Provider implements OAuth1 {
  constructor(
    private readonly oauth: OAuth1 = new OAuth1DefaultImpl(
      PROVIDER_GARMIN,
      Config.getGarminConsumerKey(),
      Config.getGarminConsumerSecret(),
      "https://connect.garmin.com/oauthConfirm",
      "https://connectapi.garmin.com/oauth-service/oauth/request_token", //Garmin.URL
      "https://connectapi.garmin.com/oauth-service/oauth/access_token"
    )
  ) {
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

  async processStep1(token: string) {
    return this.oauth.processStep1(token);
  }

  async processStep2(userToken: UserToken, oauth_verifier: string) {
    return this.oauth.processStep2(userToken, oauth_verifier);
  }

  async deregister(userAccessTokens: string[], cxId?: string): Promise<void> {
    return this.oauth.deregister(userAccessTokens, cxId);
  }
}
