/* eslint-disable @typescript-eslint/no-empty-function */
import * as uuidv7_file from "@metriport/core/util/uuid-v7";
import { makeDocumentQueryProgress } from "../../../../domain/medical/__tests__/document-query";
import { PatientModel } from "../../../../models/medical/patient";
import { mockStartTransaction } from "../../../../models/__tests__/transaction";
import { getOrGenerateRequestId } from "../document-query";
import * as whMedical from "../document-webhook";

let uuidv7_mock: jest.SpyInstance;

beforeEach(() => {
  jest.restoreAllMocks();
  mockStartTransaction();
  jest.spyOn(PatientModel, "findOne");
  jest.spyOn(whMedical, "processPatientDocumentRequest").mockImplementation(async () => {});
  uuidv7_mock = jest.spyOn(uuidv7_file, "uuidv7");
});

describe("document-query", () => {
  describe("queryDocumentsAcrossHIEs", () => {
    it("works", async () => {
      // TODO 785 IMPLEMENT IT
    });
  });

  describe("getOrGenerateRequestId", () => {
    afterEach(() => {
      uuidv7_mock.mockRestore();
    });
    it(`returns new reqId when no doc query status`, async () => {
      const expectedResult = uuidv7_file.uuidv4();
      uuidv7_mock.mockReturnValue(expectedResult);
      const res = getOrGenerateRequestId(undefined);
      expect(res).toEqual(expectedResult);
    });
    it(`returns existing when download is processing`, async () => {
      const expectedResult = uuidv7_file.uuidv4();
      const docQueryProgress = makeDocumentQueryProgress({
        download: { status: "processing" },
        convert: { status: "completed" },
        requestId: expectedResult,
      });
      const res = getOrGenerateRequestId(docQueryProgress);
      expect(res).toEqual(expectedResult);
    });
    it(`returns existing when convert is processing`, async () => {
      const expectedResult = uuidv7_file.uuidv4();
      const docQueryProgress = makeDocumentQueryProgress({
        download: { status: "completed" },
        convert: { status: "processing" },
        requestId: expectedResult,
      });
      const res = getOrGenerateRequestId(docQueryProgress);
      expect(res).toEqual(expectedResult);
    });
    it(`returns a new one when both are completed`, async () => {
      const expectedResult = uuidv7_file.uuidv4();
      uuidv7_mock.mockReturnValue(expectedResult);
      const docQueryProgress = makeDocumentQueryProgress({
        download: { status: "completed" },
        convert: { status: "completed" },
        requestId: uuidv7_file.uuidv4(),
      });
      const res = getOrGenerateRequestId(docQueryProgress);
      expect(res).toEqual(expectedResult);
    });
    it(`returns a new one when both are failed`, async () => {
      const expectedResult = uuidv7_file.uuidv4();
      uuidv7_mock.mockReturnValue(expectedResult);
      const docQueryProgress = makeDocumentQueryProgress({
        download: { status: "failed" },
        convert: { status: "failed" },
        requestId: uuidv7_file.uuidv4(),
      });
      const res = getOrGenerateRequestId(docQueryProgress);
      expect(res).toEqual(expectedResult);
    });
  });
});
