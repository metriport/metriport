import { NextFunction, Request, Response } from "express";
import { processEhrId } from "../middleware";

const dummyResp = {} as unknown as Response;
const dummyNext: NextFunction = function () {
  return;
};

describe("processEhrId", () => {
  it("sets valid ehrId in query", () => {
    const incomingRequest = {
      params: {
        ehrId: "athenahealth",
      },
      query: {},
    } as unknown as Request;
    processEhrId(incomingRequest, dummyResp, dummyNext);
    expect(incomingRequest.query.ehrId).toBe("athenahealth");
  });
  it("throws error when ehrId is invalid", () => {
    const incomingRequest = {
      params: {
        ehrId: "invalid",
      },
      query: {},
    } as unknown as Request;
    expect(() => processEhrId(incomingRequest, dummyResp, dummyNext)).toThrow("Invalid EHR");
  });
});
