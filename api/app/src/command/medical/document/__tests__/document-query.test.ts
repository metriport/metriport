/* eslint-disable @typescript-eslint/no-empty-function */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.test" });
// Keep dotenv import and config before everything else
import { PatientModel } from "../../../../models/medical/patient";
import { makePatient, makePatientModel } from "../../../../models/medical/__tests__/patient";
import { mockStartTransaction } from "../../../../models/__tests__/transaction";
import * as docQueryProgress from "../../patient/append-doc-query-progress";
import * as docQuery from "../document-query";
import { updateDocQuery } from "../document-query";

const patientModel = makePatientModel();
let docQuery_calculateAndUpdateDocQuery: jest.SpyInstance;
let appendDocQueryProgress_mock: jest.SpyInstance;
beforeEach(() => {
  jest.restoreAllMocks();
  mockStartTransaction();
  jest.spyOn(PatientModel, "findOne");
  docQuery_calculateAndUpdateDocQuery = jest
    .spyOn(docQuery, "updateConversionProgress")
    .mockImplementation(async () => patientModel);
  appendDocQueryProgress_mock = jest
    .spyOn(docQueryProgress, "appendDocQueryProgress")
    .mockImplementation(async () => patientModel);
});

describe("document-query", () => {
  describe("queryDocumentsAcrossHIEs", () => {
    it("works", async () => {
      // TODO 785 IMPLEMENT IT
    });
  });

  describe("updateDocQuery", () => {
    it(`Calls calculateAndUpdateDocQuery when convertResult is present`, async () => {
      const patient = makePatient();
      await updateDocQuery({ patient, convertResult: "success" });
      expect(docQuery_calculateAndUpdateDocQuery).toHaveBeenCalled();
    });

    // TODO check params are passed to calculateAndUpdateDocQuery

    it(`return result of calculateAndUpdateDocQuery`, async () => {
      const patient = makePatient();
      const res = await updateDocQuery({ patient, convertResult: "success" });
      expect(res).toEqual(patientModel);
    });

    it(`Calls setDocQueryProgress when convertResult is not present`, async () => {
      const patient = makePatient();
      await updateDocQuery({ patient, convertProgress: { status: "processing" } });
      expect(appendDocQueryProgress_mock).toHaveBeenCalled();
    });

    // TODO check params are passed to setDocQueryProgress

    it(`return result of setDocQueryProgress`, async () => {
      const patient = makePatient();
      const res = await updateDocQuery({ patient, convertProgress: { status: "processing" } });
      expect(res).toEqual(patientModel);
    });
  });
});
