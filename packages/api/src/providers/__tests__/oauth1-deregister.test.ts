/* eslint-disable @typescript-eslint/no-empty-function */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.test" });
// Keep dotenv import and config before everything else
import * as updateProviderDataFile from "../../command/connected-user/save-connected-user";
import * as getUserTokenFile from "../../command/cx-user/get-user-token";
import * as saveUserTokenFile from "../../command/cx-user/save-user-token";
import {
  TestGarmin,
  anotherUserTokenMocked,
  testUser,
  testUserModified,
  thirdTestUser,
  userTokenMocked,
  userTokenModified,
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

    saveUserTokenMock.mockReturnValue(userTokenModified);
    updateProviderDataMock.mockReturnValue(testUserModified);

    if (testUser.providerMap?.garmin?.token)
      await testGarmin.deregister([testUser.providerMap.garmin.token]);

    expect(getUserTokenByUATMock).toHaveBeenCalledTimes(1);
    expect(saveUserTokenMock).toHaveBeenCalledTimes(2);
    expect(updateProviderDataMock).toHaveBeenCalledTimes(2);
  });

  it("deregisters users from the correct cx", async () => {
    getUserTokenByUATMock.mockReturnValueOnce([userTokenMocked, anotherUserTokenMocked]);
    saveUserTokenMock.mockReturnValueOnce(userTokenMocked);
    updateProviderDataMock.mockReturnValueOnce(testUserModified);

    if (testUser.providerMap?.garmin?.token)
      await testGarmin.deregister([testUser.providerMap.garmin.token], testUser.cxId);

    expect(getUserTokenByUATMock).toHaveBeenCalledTimes(1);
    expect(saveUserTokenMock).toHaveBeenCalledTimes(1);
    expect(updateProviderDataMock).toHaveBeenCalledTimes(1);
  });

  it("processes multiple tokens", async () => {
    getUserTokenByUATMock.mockReturnValue([userTokenMocked]);
    saveUserTokenMock.mockReturnValue(userTokenMocked);
    updateProviderDataMock.mockReturnValue(testUserModified);

    if (testUser.providerMap?.garmin?.token && thirdTestUser.providerMap?.garmin?.token)
      await testGarmin.deregister(
        [testUser.providerMap.garmin.token, thirdTestUser.providerMap.garmin.token],
        testUser.cxId
      );

    expect(getUserTokenByUATMock).toHaveBeenCalledTimes(2);
    expect(saveUserTokenMock).toHaveBeenCalledTimes(2);
    expect(updateProviderDataMock).toHaveBeenCalledTimes(2);
  });
});
