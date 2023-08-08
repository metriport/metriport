import { UserToken } from "../user-token";

export function makeUserToken(token: Partial<UserToken>): UserToken {
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
