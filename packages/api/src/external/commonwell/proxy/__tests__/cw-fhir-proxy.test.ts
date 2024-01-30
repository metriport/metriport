/* eslint-disable @typescript-eslint/no-empty-function */
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import NotFoundError from "../../../../errors/not-found";
import * as helper from "../get-org-or-fail";
import { processBinary, processDocReference } from "../process-inbound";

describe("cw-fhir-proxy", () => {
  // Couldn't get this to work within the timebox
  // Should also add this import: `import * as lib from "../cw-fhir-proxy";`
  // describe("process", () => {
  // let processBinaryMock: jest.SpyInstance;
  // beforeAll(() => {
  //   processBinaryMock = jest.spyOn(lib, "processBinary");
  //   processBinaryMock.mockImplementation(async () => mockResponseProcessBinary);
  // });
  // afterAll(() => {
  //   processBinaryMock.mockRestore();
  // });
  // it("calls processBinary when Binary", async () => {
  //   const res = await process("Binary");
  //   expect(res).toBeTruthy();
  //   expect(processBinaryMock).toHaveBeenCalledTimes(1);
  // });
  // });

  describe("processDocReference", () => {
    let mock_getOrgOrFail: jest.SpyInstance;
    beforeAll(() => {
      mock_getOrgOrFail = jest.spyOn(helper, "getOrgOrFail");
    });
    beforeEach(() => {
      jest.clearAllMocks();
    });
    const makeQuery = (patientParamName: string, patientParamValue: string) =>
      `_include=DocumentReference:patient` +
      `&_include=DocumentReference:subject` +
      `&_include=DocumentReference:authenticator` +
      `&_include=DocumentReference:author` +
      `&_include=DocumentReference:custodian` +
      `&_include=DocumentReference:encounter` +
      `&${patientParamName}=${patientParamValue}` +
      `&status=current`;

    it("throws when gets no query params", async () => {
      const path = `/DocumentReference`;
      await expect(processDocReference(path)).rejects.toThrow("Missing query string");
    });

    it("throws when gets NotFoundError", async () => {
      const orgId = "2.16.840.1.113883.3.9621.5.106";
      const patientId = "2.16.840.1.113883.3.9621.5.106.2.102";
      const path = `/DocumentReference`;
      const inputPatientParam = "patient.identifier";
      const inputQuery = makeQuery(inputPatientParam, `urn:oid:${orgId}%7C${patientId}`);
      mock_getOrgOrFail.mockRejectedValueOnce(new NotFoundError("not found"));
      await expect(processDocReference(path, inputQuery)).rejects.toThrow("not found");
    });

    it("returns expected when URL has tenant", async () => {
      const tenant = "1541456f-6734-42a5-9eb7-ef0d98b10d49";
      const orgId = "2.16.840.1.113883.3.9621.5.106";
      const patientId = uuidv7();
      const path = `/DocumentReference`;
      const inputPatientParam = "patient.identifier";
      const expectedPatientParam = "patient";
      const inputQuery = makeQuery(inputPatientParam, `urn:oid:${orgId}%7C${patientId}`);
      const expectedQuery = makeQuery(expectedPatientParam, patientId);
      mock_getOrgOrFail.mockImplementation(async () => ({ cxId: tenant }));
      const res = await processDocReference(path, inputQuery);
      expect(res).toBeTruthy();
      expect(res.updatedPath).toEqual(path);
      expect(res.updatedQuery).toEqual(expectedQuery);
      expect(res.tenant).toEqual(tenant);
    });
  });

  describe("processBinary", () => {
    it("returns expected when URL has tenant", async () => {
      const tenant = "1541456f-6734-42a5-9eb7-ef0d98b10d49";
      const expectedPath = "/Binary/007df4f8-ecfd-4709-ac73-24982c981af5";
      const path = "/" + tenant + expectedPath;
      const query = "";
      const res = processBinary(path, query);
      expect(res).toBeTruthy();
      expect(res.updatedPath).toEqual(expectedPath);
      expect(res.updatedQuery).toEqual(query);
      expect(res.tenant).toEqual(tenant);
    });
    it("returns expected with URL does not have tenant", async () => {
      const tenant = "";
      const expectedPath = "/Binary/007df4f8-ecfd-4709-ac73-24982c981af5";
      const path = expectedPath;
      const query = "";
      const res = processBinary(path, query);
      expect(res).toBeTruthy();
      expect(res.updatedPath).toEqual(expectedPath);
      expect(res.updatedQuery).toEqual(query);
      expect(res.tenant).toEqual(tenant);
    });
    it("returns expected when URL has query params", async () => {
      const tenant = "1541456f-6734-42a5-9eb7-ef0d98b10d49";
      const expectedPath = "/Binary/007df4f8-ecfd-4709-ac73-24982c981af5";
      const path = "/" + tenant + expectedPath;
      const query = "?something=else";
      const res = processBinary(path, query);
      expect(res).toBeTruthy();
      expect(res.updatedPath).toEqual(expectedPath);
      expect(res.updatedQuery).toEqual(query);
      expect(res.updatedQuery).toEqual(query);
      expect(res.tenant).toEqual(tenant);
    });
  });
});
