/* eslint-disable @typescript-eslint/no-empty-function */
import { v4 as uuidv4 } from "uuid";
import { MAPIAccess } from "../../../models/medical/mapi-access";
import { makeOrganization } from "../../../domain/medical/__tests__/organization";
import { allowMapiAccess } from "../mapi-access";
import * as getOrg from "../organization/get-organization";

let getOrganizationOrFailMock: jest.SpyInstance;
beforeEach(() => {
  jest.restoreAllMocks();
  getOrganizationOrFailMock = jest.spyOn(getOrg, "getOrganizationOrFail");
});

describe("allowMapiAccess", () => {
  const cxId = uuidv4();

  it("returns when there is access", async () => {
    MAPIAccess.findByPk = jest.fn().mockResolvedValueOnce({} as MAPIAccess);
    MAPIAccess.create = jest.fn().mockImplementation(() => Promise.resolve());
    getOrganizationOrFailMock.mockReturnValueOnce(makeOrganization());

    await allowMapiAccess(cxId);

    expect(MAPIAccess.create).not.toHaveBeenCalled();
    expect(getOrganizationOrFailMock).not.toHaveBeenCalled();
  });

  it("gives MAPI access when no access", async () => {
    MAPIAccess.findByPk = jest.fn().mockResolvedValueOnce(undefined);
    MAPIAccess.create = jest.fn().mockImplementation(() => Promise.resolve());
    getOrganizationOrFailMock.mockReturnValueOnce(makeOrganization());

    await allowMapiAccess(cxId);

    expect(MAPIAccess.create).toHaveBeenCalledWith({ id: cxId });
  });
});
