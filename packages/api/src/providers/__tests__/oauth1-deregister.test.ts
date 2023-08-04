/* eslint-disable @typescript-eslint/no-empty-function */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.test" });
// Keep dotenv import and config before everything else
import * as updateProviderDataFile from "../../command/connected-user/save-connected-user";
import * as getUserTokenFile from "../../command/cx-user/get-user-token";
import * as saveUserTokenFile from "../../command/cx-user/save-user-token";
import { PROVIDER_GARMIN } from "../../shared/constants";
import { OAuth1DefaultImpl } from "../oauth1";
import {
  userToken_2,
  userToken_2_upd,
  testUser_1,
  testUser_1_upd,
  testUser_2,
  userToken_1_upd,
  userToken_1,
  testUser_2_upd,
} from "./deregister-input";

let getUserTokenByUATMock: jest.SpyInstance;
let saveUserTokenMock: jest.SpyInstance;
let updateProviderDataMock: jest.SpyInstance;

beforeEach(() => {
  jest.restoreAllMocks();
  getUserTokenByUATMock = jest.spyOn(getUserTokenFile, "getUserTokenByUAT");
  saveUserTokenMock = jest.spyOn(saveUserTokenFile, "saveUserToken");
  updateProviderDataMock = jest.spyOn(updateProviderDataFile, "updateProviderData");
});

const testGarmin = new OAuth1DefaultImpl(PROVIDER_GARMIN, "", "", "", "", "");

describe("oauth1-deregister", () => {
  it("handles empty uat array", async () => {
    await testGarmin.deregister([]);

    expect(getUserTokenByUATMock).not.toHaveBeenCalled();
    expect(saveUserTokenFile.saveUserToken).not.toHaveBeenCalled();
    expect(updateProviderDataFile.updateProviderData).not.toHaveBeenCalled();
  });

  it("deregisters users if no cxid provided", async () => {
    getUserTokenByUATMock.mockReturnValueOnce([userToken_1, userToken_2]);

    saveUserTokenMock.mockReturnValueOnce(userToken_1_upd);
    saveUserTokenMock.mockReturnValueOnce(userToken_2_upd);

    updateProviderDataMock.mockReturnValue(testUser_1_upd);

    await testGarmin.deregister([testUser_1.providerMap.garmin.token]);

    expect(getUserTokenByUATMock).toHaveBeenCalledTimes(1);
    expect(getUserTokenByUATMock).toHaveBeenCalledWith({
      oauthUserAccessToken: testUser_1.providerMap.garmin.token,
    });

    expect(saveUserTokenMock).toHaveBeenCalledTimes(2);

    const firstToken = saveUserTokenMock.mock.calls[0][0];
    const secondToken = saveUserTokenMock.mock.calls[1][0];

    expect(firstToken).toEqual(
      expect.objectContaining({
        oauthUserAccessToken: undefined,
        oauthUserAccessSecret: undefined,
      })
    );
    expect(secondToken).toEqual(
      expect.objectContaining({
        oauthUserAccessToken: undefined,
        oauthUserAccessSecret: undefined,
      })
    );

    expect(updateProviderDataMock).toHaveBeenCalledTimes(2);
    expect(updateProviderDataMock).toHaveBeenCalledWith({
      id: userToken_1_upd.userId,
      cxId: userToken_1_upd.cxId,
      provider: "garmin",
      providerItem: undefined,
    });
    expect(updateProviderDataMock).toHaveBeenCalledWith({
      id: userToken_2_upd.userId,
      cxId: userToken_2_upd.cxId,
      provider: "garmin",
      providerItem: undefined,
    });
  });

  it("deregisters users from the correct cx", async () => {
    getUserTokenByUATMock.mockReturnValueOnce([userToken_1, userToken_2]);
    saveUserTokenMock.mockReturnValueOnce(userToken_1_upd);
    updateProviderDataMock.mockReturnValueOnce(testUser_1_upd);

    await testGarmin.deregister([testUser_1.providerMap.garmin.token], testUser_1.cxId);

    expect(getUserTokenByUATMock).toHaveBeenCalledTimes(1);
    expect(getUserTokenByUATMock).toHaveBeenCalledWith({
      oauthUserAccessToken: testUser_1.providerMap.garmin.token,
    });
    expect(saveUserTokenMock).toHaveBeenCalledTimes(1);

    const firstToken = saveUserTokenMock.mock.calls[0][0];

    expect(firstToken).toEqual(
      expect.objectContaining({
        oauthUserAccessToken: undefined,
        oauthUserAccessSecret: undefined,
      })
    );

    expect(updateProviderDataMock).toHaveBeenCalledTimes(1);
    expect(updateProviderDataMock).toHaveBeenCalledWith({
      id: userToken_1_upd.userId,
      cxId: userToken_1_upd.cxId,
      provider: "garmin",
      providerItem: undefined,
    });
  });

  it("processes multiple tokens", async () => {
    getUserTokenByUATMock.mockReturnValueOnce([userToken_1]);
    getUserTokenByUATMock.mockReturnValueOnce([userToken_2]);
    saveUserTokenMock.mockReturnValueOnce(userToken_1_upd);
    saveUserTokenMock.mockReturnValueOnce(userToken_2_upd);
    updateProviderDataMock.mockReturnValueOnce(testUser_1_upd);
    updateProviderDataMock.mockReturnValueOnce(testUser_2_upd);

    await testGarmin.deregister([
      testUser_1.providerMap.garmin.token,
      testUser_2.providerMap.garmin.token,
    ]);

    expect(getUserTokenByUATMock).toHaveBeenCalledTimes(2);
    expect(getUserTokenByUATMock).toHaveBeenCalledWith({
      oauthUserAccessToken: testUser_1.providerMap.garmin.token,
    });
    expect(getUserTokenByUATMock).toHaveBeenCalledWith({
      oauthUserAccessToken: testUser_2.providerMap.garmin.token,
    });

    const firstTokenList = getUserTokenByUATMock.mock.calls[0][0];
    const secondTokenList = getUserTokenByUATMock.mock.calls[1][0];

    expect(firstTokenList).toEqual(
      expect.objectContaining({
        oauthUserAccessToken: "some_uat_string",
      })
    );
    expect(secondTokenList).toEqual(
      expect.objectContaining({
        oauthUserAccessToken: "crazy_uat_string",
      })
    );

    const firstToken = saveUserTokenMock.mock.calls[0][0];
    const secondToken = saveUserTokenMock.mock.calls[1][0];
    expect(saveUserTokenMock).toHaveBeenCalledTimes(2);
    expect(firstToken).toEqual(
      expect.objectContaining({
        oauthUserAccessToken: undefined,
        oauthUserAccessSecret: undefined,
      })
    );
    expect(secondToken).toEqual(
      expect.objectContaining({
        oauthUserAccessToken: undefined,
        oauthUserAccessSecret: undefined,
      })
    );

    expect(updateProviderDataMock).toHaveBeenCalledTimes(2);
    expect(updateProviderDataMock).toHaveBeenCalledWith({
      id: userToken_1_upd.userId,
      cxId: userToken_1_upd.cxId,
      provider: "garmin",
      providerItem: undefined,
    });
    expect(updateProviderDataMock).toHaveBeenCalledWith({
      id: userToken_2_upd.userId,
      cxId: userToken_2_upd.cxId,
      provider: "garmin",
      providerItem: undefined,
    });

    const firstUserUpd = updateProviderDataMock.mock.results[0].value;
    const secondUserUpd = updateProviderDataMock.mock.results[1].value;
    expect(firstUserUpd).toEqual(
      expect.objectContaining({
        providerMap: {},
      })
    );
    expect(secondUserUpd).toEqual(
      expect.objectContaining({
        providerMap: {
          fitbit: {
            token: "qweasdzxc",
          },
        },
      })
    );
  });
});
