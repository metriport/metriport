import { UserToken } from "../../domain/user-token";
import { PROVIDER_GARMIN } from "../../shared/constants";
import { OAuth1, OAuth1DefaultImpl } from "../oauth1";
import Provider, { ConsumerHealthDataType } from "../provider";

function createUserToken(token: Partial<UserToken>): UserToken {
  return UserToken.build({
    token: token.token || "",
    cxId: token.cxId || "",
    userId: token.userId || "",
    expiryTime: token.expiryTime || 0,
    oauthRequestToken: token.oauthRequestToken || "",
    oauthRequestSecret: token.oauthRequestSecret || "",
    oauthUserAccessToken: token.oauthUserAccessToken || "",
    oauthUserAccessSecret: token.oauthUserAccessSecret || "",
  });
}

const commonUserAttributes = {
  token: "connect_token",
  userId: "user_id",
  expiryTime: 1690851486,
  oauthRequestToken: "",
  oauthRequestSecret: "",
};

export const userTokenMocked: UserToken = {
  ...commonUserAttributes,
  cxId: "1234",
  oauthUserAccessToken: "some_uat_string",
  oauthUserAccessSecret: "some_ua_secret_string",

  clone: function (): UserToken {
    return createUserToken(this);
  },
};

export const userTokenModified: UserToken = {
  ...commonUserAttributes,
  cxId: "1234",
  oauthUserAccessToken: undefined,
  oauthUserAccessSecret: undefined,

  clone: function (): UserToken {
    return createUserToken(this);
  },
};

export const anotherUserTokenMocked: UserToken = {
  ...commonUserAttributes,
  cxId: "4321",
  oauthUserAccessToken: "some_uat_string",
  oauthUserAccessSecret: "some_ua_secret_string",

  clone: function (): UserToken {
    return createUserToken(this);
  },
};

export const anotherUserTokenMockedModified: UserToken = {
  ...commonUserAttributes,
  cxId: "4321",
  oauthUserAccessToken: undefined,
  oauthUserAccessSecret: undefined,

  clone: function (): UserToken {
    return createUserToken(this);
  },
};

export const testUser = {
  cxId: "1234",
  providerMap: {
    garmin: {
      token: userTokenMocked.oauthUserAccessToken,
    },
  },
};

export const thirdTestUser = {
  cxId: "1234",
  providerMap: {
    garmin: {
      token: "crazy_token_string",
    },
  },
};

export const testUserModified = {
  cxId: "1234",
  providerMap: {},
};

export class TestGarmin extends Provider implements OAuth1 {
  constructor(
    private readonly oauth: OAuth1 = new OAuth1DefaultImpl(PROVIDER_GARMIN, "", "", "", "", "")
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
