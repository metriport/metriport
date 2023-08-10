import { nanoid } from "nanoid";
import { UserToken } from "../user-token";
import { v4 as uuidv4 } from "uuid";

export const makeUserToken = (token: Partial<UserToken>): UserToken => {
  return {
    token: token.token ?? nanoid(),
    cxId: token.cxId ?? uuidv4(),
    userId: token.userId ?? uuidv4(),
    expiryTime: token.expiryTime ?? getPastTimestamp(),
    oauthRequestToken: token.oauthRequestToken ?? "",
    oauthRequestSecret: token.oauthRequestSecret ?? "",
    oauthUserAccessToken: token.oauthUserAccessToken ?? nanoid(),
    oauthUserAccessSecret: token.oauthUserAccessSecret ?? nanoid(),
    clone: function (): UserToken {
      return makeUserToken(this);
    },
  };
};

function getPastTimestamp(): number {
  const currentDate = new Date();
  const pastDate = new Date(currentDate);
  pastDate.setDate(currentDate.getDate() - 1);

  return Math.floor(pastDate.getTime() / 1000);
}
