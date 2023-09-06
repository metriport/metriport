/* eslint-disable @typescript-eslint/no-empty-function */
import { nanoid } from "nanoid";
import { v4 as uuidv4 } from "uuid";
import * as updateProviderDataFile from "../../command/connected-user/save-connected-user";
import * as getUserTokenFile from "../../command/cx-user/get-user-token";
import * as saveUserTokenFile from "../../command/cx-user/save-user-token";
import { makeConnectedUser } from "../../domain/__tests__/make-connected-user";
import { makeUserToken } from "../../domain/__tests__/user-token";
import { PROVIDER_GARMIN } from "../../shared/constants";
import { OAuth1DefaultImpl } from "../shared/oauth1";

let getUserTokenByUATMock: jest.SpyInstance;
let saveUserTokenMock: jest.SpyInstance;
let updateProviderDataMock: jest.SpyInstance;

beforeEach(() => {
  const { userId, cxId, userId_2, cxId_2 } = makeUserTokensAndUsers();
  jest.restoreAllMocks();
  getUserTokenByUATMock = jest.spyOn(getUserTokenFile, "getUserTokenByUAT");
  saveUserTokenMock = jest.spyOn(saveUserTokenFile, "saveUserToken");
  updateProviderDataMock = jest.spyOn(updateProviderDataFile, "updateProviderData");
  saveUserTokenMock.mockReturnValueOnce(
    makeUserToken({
      userId,
      cxId,
      oauthUserAccessToken: undefined,
      oauthUserAccessSecret: undefined,
    })
  );
  saveUserTokenMock.mockReturnValueOnce(
    makeUserToken({
      userId: userId_2,
      cxId: cxId_2,
      oauthUserAccessToken: undefined,
      oauthUserAccessSecret: undefined,
    })
  );
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
    const { userId, cxId, garminToken, userId_2, cxId_2, garminToken_2 } = makeUserTokensAndUsers();
    getUserTokenByUATMock.mockReturnValueOnce([
      makeUserToken({ userId, cxId, oauthUserAccessToken: garminToken }),
      makeUserToken({ userId: userId_2, cxId: cxId_2, oauthUserAccessToken: garminToken_2 }),
    ]);

    await testGarmin.deregister([garminToken]);
    expect(getUserTokenByUATMock).toHaveBeenCalledTimes(1);
    expect(getUserTokenByUATMock).toHaveBeenCalledWith({
      oauthUserAccessToken: garminToken,
    });
    expect(saveUserTokenMock).toHaveBeenCalledTimes(2);
    const firstToken = saveUserTokenMock.mock.calls[0][0];
    const secondToken = saveUserTokenMock.mock.calls[1][0];
    expect(firstToken).toEqual(
      expect.objectContaining({
        cxId,
        oauthUserAccessToken: undefined,
        oauthUserAccessSecret: undefined,
      })
    );
    expect(secondToken).toEqual(
      expect.objectContaining({
        cxId: cxId_2,
        oauthUserAccessToken: undefined,
        oauthUserAccessSecret: undefined,
      })
    );
    expect(updateProviderDataMock).toHaveBeenCalledTimes(2);
    expect(updateProviderDataMock).toHaveBeenCalledWith({
      id: userId,
      cxId,
      provider: "garmin",
      providerItem: undefined,
    });
    expect(updateProviderDataMock).toHaveBeenCalledWith({
      id: userId_2,
      cxId: cxId_2,
      provider: "garmin",
      providerItem: undefined,
    });
  });

  it("deregisters users from the correct cx", async () => {
    const { userId, cxId, garminToken, userId_2, cxId_2, garminToken_2 } = makeUserTokensAndUsers();
    getUserTokenByUATMock.mockReturnValueOnce([
      makeUserToken({ userId, cxId, oauthUserAccessToken: garminToken }),
      makeUserToken({ userId: userId_2, cxId: cxId_2, oauthUserAccessToken: garminToken_2 }),
    ]);

    await testGarmin.deregister([garminToken], cxId);
    expect(getUserTokenByUATMock).toHaveBeenCalledTimes(1);
    expect(saveUserTokenMock).toHaveBeenCalledTimes(1);
    expect(updateProviderDataMock).toHaveBeenCalledTimes(1);
  });

  it("processes multiple tokens", async () => {
    const { userId, cxId, garminToken, userId_2, cxId_2, garminToken_2 } = makeUserTokensAndUsers();
    getUserTokenByUATMock.mockReturnValueOnce([
      makeUserToken({ userId, cxId, oauthUserAccessToken: garminToken }),
    ]);
    getUserTokenByUATMock.mockReturnValueOnce([
      makeUserToken({ userId: userId_2, cxId: cxId_2, oauthUserAccessToken: garminToken_2 }),
    ]);

    updateProviderDataMock.mockReturnValueOnce(await makeConnectedUser({ id: userId, cxId }));

    await testGarmin.deregister([garminToken, garminToken_2]);
    expect(getUserTokenByUATMock).toHaveBeenCalledTimes(2);
    expect(getUserTokenByUATMock).toHaveBeenCalledWith({
      oauthUserAccessToken: garminToken,
    });
    expect(getUserTokenByUATMock).toHaveBeenCalledWith({
      oauthUserAccessToken: garminToken_2,
    });

    expect(saveUserTokenMock).toHaveBeenCalledTimes(2);
    expect(updateProviderDataMock).toHaveBeenCalledTimes(2);
  });
});

function makeUserTokensAndUsers() {
  return {
    userId: uuidv4(),
    cxId: uuidv4(),
    garminToken: nanoid(),
    userId_2: uuidv4(),
    cxId_2: uuidv4(),
    garminToken_2: nanoid(),
  };
}
