import { nanoid } from "nanoid";
import { UserToken } from "../user-token";
import { v4 as uuidv4 } from "uuid";
import { faker } from "@faker-js/faker";

export const makeUserToken = (token: Partial<UserToken>): UserToken => {
  return {
    token: token.token ?? nanoid(),
    cxId: token.cxId ?? uuidv4(),
    userId: token.userId ?? uuidv4(),
    expiryTime: token.expiryTime ?? faker.date.past().getTime(),
    oauthRequestToken: token.oauthRequestToken ?? "",
    oauthRequestSecret: token.oauthRequestSecret ?? "",
    oauthUserAccessToken: token.oauthUserAccessToken ?? nanoid(),
    oauthUserAccessSecret: token.oauthUserAccessSecret ?? nanoid(),
    clone: function (): UserToken {
      return makeUserToken(this);
    },
  };
};
