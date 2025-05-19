import { Request, Response } from "express";
import { processEhrPatientId } from "../shared";
import { tokenEhrPatientIdQueryParam } from "../eclinicalworks/auth/middleware";

describe("documentDownloadUrlRegex bypass", () => {
  const mockRequest = (path: string, patientId?: string) => {
    return {
      path,
      query: patientId
        ? {
            [tokenEhrPatientIdQueryParam]: patientId,
            patientEhrId: patientId,
          }
        : {},
    } as unknown as Request;
  };

  const mockResponse = () => ({} as Response);

  let next_mock: jest.Mock;
  let req_mock: Request;
  let res_mock: Response;

  beforeEach(() => {
    next_mock = jest.fn();
    res_mock = mockResponse();
  });

  it("allows requests to /download-url without a patient ID", () => {
    req_mock = mockRequest("/download-url");

    const middleware = processEhrPatientId(tokenEhrPatientIdQueryParam, "query", [
      new RegExp("^/download-url$"),
    ]);
    middleware(req_mock, res_mock, next_mock);
    expect(next_mock).toHaveBeenCalled();
    expect(next_mock).not.toHaveBeenCalledWith(expect.any(Error));
  });

  it("requires patient ID for non-matching paths", () => {
    req_mock = mockRequest("/other-path");

    const middleware = processEhrPatientId(tokenEhrPatientIdQueryParam, "query", [
      new RegExp("^/download-url$"),
    ]);
    middleware(req_mock, res_mock, next_mock);
    expect(next_mock).toHaveBeenCalledWith(expect.any(Error));
  });

  it("allows requests with a valid patient ID regardless of path", () => {
    req_mock = mockRequest("/any-path", "valid-patient-id");

    const middleware = processEhrPatientId(tokenEhrPatientIdQueryParam, "query", [
      new RegExp("^/download-url$"),
    ]);
    middleware(req_mock, res_mock, next_mock);
    expect(next_mock).toHaveBeenCalled();
    expect(next_mock).not.toHaveBeenCalledWith(expect.any(Error));
  });

  it("allows request when token and request patient IDs match via path param", () => {
    req_mock = {
      path: "/patient/123",
      query: { [tokenEhrPatientIdQueryParam]: "123" },
      params: { id: "123" },
    } as unknown as Request;

    const middleware = processEhrPatientId(tokenEhrPatientIdQueryParam, "params");
    middleware(req_mock, res_mock, next_mock);
    expect(next_mock).toHaveBeenCalled();
    expect(next_mock).not.toHaveBeenCalledWith(expect.any(Error));
  });

  it("throws if token patient ID doesn't match path param", () => {
    req_mock = {
      path: "/patient/123",
      query: { [tokenEhrPatientIdQueryParam]: "456" },
      params: { id: "123" },
    } as unknown as Request;

    const middleware = processEhrPatientId(tokenEhrPatientIdQueryParam, "params");
    middleware(req_mock, res_mock, next_mock);
    expect(next_mock).toHaveBeenCalledWith(expect.any(Error));
  });

  it("throws error when tokenEhrPatientId is missing in query", () => {
    req_mock = {
      path: "/any-path",
      query: {},
      params: { id: "123" },
    } as unknown as Request;

    const middleware = processEhrPatientId(tokenEhrPatientIdQueryParam, "query");
    middleware(req_mock, res_mock, next_mock);
    expect(next_mock).toHaveBeenCalledWith(expect.any(Error));
  });

  it("falls back to path param when patientEhrId is missing in query", () => {
    req_mock = {
      path: "/any-path",
      query: { [tokenEhrPatientIdQueryParam]: "123" },
      params: { id: "123" },
    } as unknown as Request;

    const middleware = processEhrPatientId(tokenEhrPatientIdQueryParam, "query");
    middleware(req_mock, res_mock, next_mock);
    expect(next_mock).toHaveBeenCalled();
    expect(next_mock).not.toHaveBeenCalledWith(expect.any(Error));
  });

  it("throws error if both patientEhrId and id are missing in query context", () => {
    req_mock = {
      path: "/any-path",
      query: { [tokenEhrPatientIdQueryParam]: "123" },
      params: {},
    } as unknown as Request;

    const middleware = processEhrPatientId(tokenEhrPatientIdQueryParam, "query");
    middleware(req_mock, res_mock, next_mock);
    expect(next_mock).toHaveBeenCalledWith(expect.any(Error));
  });

  it("skips validation if path matches one of multiple skipPaths", () => {
    req_mock = mockRequest("/download-url");

    const middleware = processEhrPatientId(tokenEhrPatientIdQueryParam, "query", [
      new RegExp("^/download-url$"),
      new RegExp("^/something-else$"),
    ]);
    middleware(req_mock, res_mock, next_mock);
    expect(next_mock).toHaveBeenCalled();
    expect(next_mock).not.toHaveBeenCalledWith(expect.any(Error));
  });
});
