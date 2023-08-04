import { createUserToken } from "../../domain/__tests__/user-token";
import { UserToken } from "../../domain/user-token";
import { v4 as uuidv4 } from "uuid";

const userId = uuidv4();
const userId_2 = uuidv4();
const cxId = uuidv4();
const cxId_2 = uuidv4();

const commonUserAttributes = {
  token: "connect_token",
  expiryTime: getPastTimestamp(),
  oauthRequestToken: "",
  oauthRequestSecret: "",
};

export const userToken_1: UserToken = {
  ...commonUserAttributes,
  userId,
  cxId,
  oauthUserAccessToken: "some_uat_string",
  oauthUserAccessSecret: "some_ua_secret_string",

  clone: function (): UserToken {
    return createUserToken(this);
  },
};

export const userToken_1_upd: UserToken = {
  ...commonUserAttributes,
  userId,
  cxId,
  oauthUserAccessToken: undefined,
  oauthUserAccessSecret: undefined,

  clone: function (): UserToken {
    return createUserToken(this);
  },
};

export const userToken_2: UserToken = {
  ...commonUserAttributes,
  userId: userId_2,
  cxId: cxId_2,
  oauthUserAccessToken: "some_uat_string",
  oauthUserAccessSecret: "some_ua_secret_string",

  clone: function (): UserToken {
    return createUserToken(this);
  },
};

export const userToken_2_upd: UserToken = {
  ...commonUserAttributes,
  userId: userId_2,
  cxId: cxId_2,
  oauthUserAccessToken: undefined,
  oauthUserAccessSecret: undefined,

  clone: function (): UserToken {
    return createUserToken(this);
  },
};

export const testUser_1 = {
  cxId,
  providerMap: {
    garmin: {
      token: "some_uat_string",
    },
  },
};

export const testUser_1_upd = {
  cxId,
  providerMap: {},
};

export const testUser_2 = {
  cxId: cxId_2,
  providerMap: {
    garmin: {
      token: "crazy_uat_string",
    },
    fitbit: {
      token: "qweasdzxc",
    },
  },
};

export const testUser_2_upd = {
  cxId: cxId_2,
  providerMap: {
    fitbit: {
      token: "qweasdzxc",
    },
  },
};

function getPastTimestamp(): number {
  const currentDate = new Date();
  const pastDate = new Date(currentDate);
  pastDate.setDate(currentDate.getDate() - 1);

  return Math.floor(pastDate.getTime() / 1000);
}
