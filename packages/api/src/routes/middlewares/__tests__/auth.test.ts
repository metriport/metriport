import { faker } from "@faker-js/faker";
import { Request, Response } from "express";
import status from "http-status";
import { nanoid } from "nanoid";
import * as mapiAccessFile from "../../../command/medical/mapi-access";
import { Config } from "../../../shared/config";
import { checkMAPIAccess, getCxIdFromApiKey } from "../auth";

describe("auth", () => {
  describe("getCxIdFromApiKey", () => {
    const makeEncodedKey = (cxId?: string | undefined) => {
      const input = cxId !== undefined ? `${nanoid()}:${cxId}` : nanoid();
      return Buffer.from(input).toString("base64");
    };

    it("throws when no encoded API key is provided", async () => {
      expect(() => getCxIdFromApiKey(undefined)).toThrow();
    });

    it(`throws when it gets empty encoded string`, async () => {
      expect(() => getCxIdFromApiKey("")).toThrow();
    });

    it(`throws when it gets invalid encoded string`, async () => {
      expect(() => getCxIdFromApiKey("N1Hqevi6FA")).toThrow();
    });

    it("throws when API key doesnt include separator and cxId", async () => {
      const encodedKey = makeEncodedKey();
      expect(() => getCxIdFromApiKey(encodedKey)).toThrow();
    });

    it("throws when API key doesnt include cxId", async () => {
      const encodedKey = makeEncodedKey("");
      expect(() => getCxIdFromApiKey(encodedKey)).toThrow();
    });

    it("cxId when its encoded correctly", async () => {
      const expectedCxId = faker.string.uuid();
      const encodedKey = makeEncodedKey(expectedCxId);
      const cxId = getCxIdFromApiKey(encodedKey);
      expect(cxId).toEqual(expectedCxId);
    });
  });

  describe("checkMAPIAccess", () => {
    const mockRequest = (cxId?: string) => {
      return {
        cxId,
        header: jest.fn().mockReturnValue("mocked-header"),
      } as unknown as Request;
    };

    const mockResponse = () => {
      const res = {} as Response;
      res.sendStatus = jest.fn().mockReturnValue(res);
      return res;
    };

    let next_mock: jest.Mock;
    let hasMapiAccess_mock: jest.SpyInstance;
    let isSandbox_mock: jest.SpyInstance;
    let req_mock: Request;
    let res_mock: Response;

    beforeEach(() => {
      jest.restoreAllMocks();
      next_mock = jest.fn();
      hasMapiAccess_mock = jest.spyOn(mapiAccessFile, "hasMapiAccess");
      isSandbox_mock = jest.spyOn(Config, "isSandbox");
      req_mock = mockRequest("validCxId");
      res_mock = mockResponse();
    });
    afterAll(() => jest.restoreAllMocks());

    it("calls next when cxId has MAPI access", async () => {
      hasMapiAccess_mock.mockReturnValueOnce(true);
      isSandbox_mock.mockReturnValueOnce(false);

      await checkMAPIAccess(req_mock, res_mock, next_mock);

      expect(next_mock).toHaveBeenCalled();
      expect(res_mock.sendStatus).not.toHaveBeenCalled();
    });

    it("calls next when in sandbox mode", async () => {
      hasMapiAccess_mock.mockReturnValueOnce(false);
      isSandbox_mock.mockReturnValueOnce(true);

      await checkMAPIAccess(req_mock, res_mock, next_mock);

      expect(next_mock).toHaveBeenCalled();
      expect(res_mock.sendStatus).not.toHaveBeenCalled();
    });

    it("sends FORBIDDEN status when cxId does not have MAPI access and not in sandbox mode", async () => {
      hasMapiAccess_mock.mockReturnValueOnce(false);
      isSandbox_mock.mockReturnValueOnce(false);

      await checkMAPIAccess(req_mock, res_mock, next_mock);

      expect(next_mock).not.toHaveBeenCalled();
      expect(res_mock.sendStatus).toHaveBeenCalledWith(status.FORBIDDEN);
    });

    it("sends INTERNAL_SERVER_ERROR status when an error occurs", async () => {
      hasMapiAccess_mock.mockRejectedValue(new Error("Test error"));

      await checkMAPIAccess(req_mock, res_mock, next_mock);

      expect(next_mock).not.toHaveBeenCalled();
      expect(res_mock.sendStatus).toHaveBeenCalledWith(status.INTERNAL_SERVER_ERROR);
    });
  });
});
