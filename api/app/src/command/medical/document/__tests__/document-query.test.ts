/* eslint-disable @typescript-eslint/no-empty-function */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.test" });
// Keep dotenv import and config before everything else
import { PatientModel } from "../../../../models/medical/patient";
import {
  makePatient,
  makePatientData,
  makePatientModel,
} from "../../../../models/medical/__tests__/patient";
import { mockStartTransaction } from "../../../../models/__tests__/transaction";
import * as whMedical from "../../../webhook/medical";
import * as docQueryProgress from "../../patient/append-doc-query-progress";
import * as docQuery from "../document-query";
import { updateDocQuery } from "../document-query";

const patientModel = makePatientModel();
let docQuery_updateConversionProgress: jest.SpyInstance;
let appendDocQueryProgress_mock: jest.SpyInstance;
let processPatientDocumentRequest_mock: jest.SpyInstance;
beforeEach(() => {
  jest.restoreAllMocks();
  mockStartTransaction();
  jest.spyOn(PatientModel, "findOne");
  docQuery_updateConversionProgress = jest
    .spyOn(docQuery, "updateConversionProgress")
    .mockImplementation(async () => patientModel);
  appendDocQueryProgress_mock = jest
    .spyOn(docQueryProgress, "appendDocQueryProgress")
    .mockImplementation(async () => patientModel);
  processPatientDocumentRequest_mock = jest
    .spyOn(whMedical, "processPatientDocumentRequest")
    .mockImplementation(async () => true);
});

describe("document-query", () => {
  describe("queryDocumentsAcrossHIEs", () => {
    it("works", async () => {
      // TODO 785 IMPLEMENT IT
    });
  });

  describe("updateDocQuery", () => {
    describe("updateConversionProgress", () => {
      it(`Calls updateConversionProgress when convertResult is present`, async () => {
        const patient = makePatient();
        await updateDocQuery({ patient, convertResult: "success" });
        expect(docQuery_updateConversionProgress).toHaveBeenCalled();
      });

      // TODO check params are passed to updateConversionProgress

      it(`return result of updateConversionProgress`, async () => {
        const patient = makePatient();
        const res = await updateDocQuery({ patient, convertResult: "success" });
        expect(res).toEqual(patientModel);
      });

      it(`triggers webhook when conversion is completed`, async () => {
        const patient = makePatient({
          data: makePatientData({
            documentQueryProgress: {
              convert: { status: "completed" },
            },
          }),
        });
        docQuery_updateConversionProgress.mockResolvedValueOnce(patient);
        await updateDocQuery({ patient, convertResult: "success" });
        expect(processPatientDocumentRequest_mock).toHaveBeenCalledWith(
          patient.cxId,
          patient.id,
          whMedical.MAPIWebhookType.documentConversion,
          whMedical.MAPIWebhookStatus.completed
        );
      });
    });

    describe("appendDocQueryProgress", () => {
      it(`Calls appendDocQueryProgress when convertResult is not present`, async () => {
        const patient = makePatient();
        await updateDocQuery({ patient, convertProgress: { status: "processing" } });
        expect(appendDocQueryProgress_mock).toHaveBeenCalled();
      });

      // TODO check params are passed to appendDocQueryProgress

      it(`return result of appendDocQueryProgress`, async () => {
        const patient = makePatient();
        const res = await updateDocQuery({ patient, convertProgress: { status: "processing" } });
        expect(res).toEqual(patientModel);
      });

      it(`triggers webhook when conversion is completed`, async () => {
        const patient = makePatient({
          data: makePatientData({
            documentQueryProgress: {
              convert: { status: "completed" },
            },
          }),
        });
        appendDocQueryProgress_mock.mockResolvedValueOnce(patient);
        await updateDocQuery({ patient, convertProgress: { status: "processing" } });
        expect(processPatientDocumentRequest_mock).toHaveBeenCalledWith(
          patient.cxId,
          patient.id,
          whMedical.MAPIWebhookType.documentConversion,
          whMedical.MAPIWebhookStatus.completed
        );
      });
    });
  });
});
