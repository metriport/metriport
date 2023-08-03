/* eslint-disable @typescript-eslint/no-empty-function */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.test" });
// Keep dotenv import and config before everything else
import * as updateProviderDataFile from "../../command/connected-user/save-connected-user";
import * as getUserTokenFile from "../../command/cx-user/get-user-token";
import * as saveUserTokenFile from "../../command/cx-user/save-user-token";
import { UserToken } from "../../domain/user-token";
import { PROVIDER_GARMIN } from "../../shared/constants";
import { OAuth1, OAuth1DefaultImpl } from "../oauth1";
import Provider, { ConsumerHealthDataType } from "../provider";
import {
  anotherUserTokenMocked,
  anotherUserTokenModified,
  testUser,
  testUserModified,
  thirdTestUser,
  userTokenMocked,
  updatedUserToken,
} from "./deregister-input";

class TestGarmin extends Provider implements OAuth1 {
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

let getUserTokenByUATMock: jest.SpyInstance;
let saveUserTokenMock: jest.SpyInstance;
let updateProviderDataMock: jest.SpyInstance;

beforeEach(() => {
  jest.restoreAllMocks();
  getUserTokenByUATMock = jest.spyOn(getUserTokenFile, "getUserTokenByUAT");
  saveUserTokenMock = jest.spyOn(saveUserTokenFile, "saveUserToken");
  updateProviderDataMock = jest.spyOn(updateProviderDataFile, "updateProviderData");
});

const testGarmin = new TestGarmin();

describe("oauth1-deregister", () => {
  it("handles empty uat array", async () => {
    await testGarmin.deregister([]);

    expect(getUserTokenByUATMock).not.toHaveBeenCalled();
    expect(saveUserTokenFile.saveUserToken).not.toHaveBeenCalled();
    expect(updateProviderDataFile.updateProviderData).not.toHaveBeenCalled();
  });

  it("deregisters users if no cxid provided", async () => {
    getUserTokenByUATMock.mockReturnValueOnce([userTokenMocked, anotherUserTokenMocked]);

    saveUserTokenMock.mockReturnValueOnce(updatedUserToken);
    saveUserTokenMock.mockReturnValueOnce(anotherUserTokenModified);

    updateProviderDataMock.mockReturnValue(testUserModified);

    await testGarmin.deregister([testUser.providerMap.garmin.token]);

    expect(getUserTokenByUATMock).toHaveBeenCalledTimes(1);
    expect(getUserTokenByUATMock).toHaveBeenCalledWith({
      oauthUserAccessToken: testUser.providerMap.garmin.token,
    });
    expect(saveUserTokenMock).toHaveBeenCalledTimes(2);
    expect(updateProviderDataMock).toHaveBeenCalledTimes(2);
    expect(updateProviderDataMock).toHaveBeenCalledWith({
      id: updatedUserToken.userId,
      cxId: updatedUserToken.cxId,
      provider: "garmin",
      providerItem: undefined,
    });
    expect(updateProviderDataMock).toHaveBeenCalledWith({
      id: anotherUserTokenModified.userId,
      cxId: anotherUserTokenModified.cxId,
      provider: "garmin",
      providerItem: undefined,
    });
  });

  it("deregisters users from the correct cx", async () => {
    getUserTokenByUATMock.mockReturnValueOnce([userTokenMocked, anotherUserTokenMocked]);
    saveUserTokenMock.mockReturnValueOnce(updatedUserToken);
    updateProviderDataMock.mockReturnValueOnce(testUserModified);

    await testGarmin.deregister([testUser.providerMap.garmin.token], testUser.cxId);

    expect(getUserTokenByUATMock).toHaveBeenCalledTimes(1);
    expect(getUserTokenByUATMock).toHaveBeenCalledWith({
      oauthUserAccessToken: testUser.providerMap.garmin.token,
    });
    expect(saveUserTokenMock).toHaveBeenCalledTimes(1);
    expect(updateProviderDataMock).toHaveBeenCalledTimes(1);
    expect(updateProviderDataMock).toHaveBeenCalledWith({
      id: updatedUserToken.userId,
      cxId: updatedUserToken.cxId,
      provider: "garmin",
      providerItem: undefined,
    });
  });

  it("processes multiple tokens", async () => {
    getUserTokenByUATMock.mockReturnValue([userTokenMocked]);
    saveUserTokenMock.mockReturnValue(userTokenMocked);
    updateProviderDataMock.mockReturnValue(testUserModified);

    await testGarmin.deregister(
      [testUser.providerMap.garmin.token, thirdTestUser.providerMap.garmin.token],
      testUser.cxId
    );

    expect(getUserTokenByUATMock).toHaveBeenCalledTimes(2);
    expect(saveUserTokenMock).toHaveBeenCalledTimes(2);
    expect(updateProviderDataMock).toHaveBeenCalledTimes(2);
  });
});
