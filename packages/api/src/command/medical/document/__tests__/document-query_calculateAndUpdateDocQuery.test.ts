/* eslint-disable @typescript-eslint/no-empty-function */
import {
  ConvertResult,
  DocumentQueryProgress,
  DocumentQueryStatus,
} from "@metriport/core/domain/document-query";
import { makePatient, makePatientData } from "@metriport/core/domain/__tests__/patient";
import { v4 as uuidv4 } from "uuid";
import { calculateConversionProgress } from "../../../../domain/medical/conversion-progress";
import { makeDocumentQueryProgress } from "../../../../domain/medical/__tests__/document-query";
import { PatientModel } from "../../../../models/medical/patient";
import { PatientMappingModel } from "../../../../models/patient-mapping";
import { mockStartTransaction } from "../../../../models/__tests__/transaction";
import { updateConversionProgress } from "../document-query";

describe("docQuery-conversionProgress", () => {
  describe("updateConversionProgress", () => {
    const patient = { data: {} };
    let patientModel: PatientModel;
    let patientModel_update: jest.SpyInstance;
    let patientModel_findOne: jest.SpyInstance;
    beforeEach(() => {
      jest.restoreAllMocks();
      mockStartTransaction();
      patientModel = { dataValues: patient } as PatientModel;
      patientModel_findOne = jest.spyOn(PatientModel, "findOne").mockResolvedValue(patientModel);
      patientModel_update = jest.spyOn(PatientModel, "update").mockImplementation(async () => [1]);
      jest.spyOn(PatientMappingModel, "findAll").mockResolvedValue([]);
    });

    it("calculateAndUpdateDocQuery send a modified object to Sequelize", async () => {
      await updateConversionProgress({
        patient: { id: "theId", cxId: "theCxId" },
        convertResult: "failed",
      });
      // ".mock.calls[0][0]" means the first parameter of the first call to that function
      const patientSentToSequelize = patientModel_update.mock.calls[0]?.[0] as
        | PatientModel
        | undefined;
      expect(patientSentToSequelize).toBeTruthy();
      expect(patientSentToSequelize === patientModel).toBeFalsy();
      expect(patientSentToSequelize?.data).toBeTruthy();
      expect(patientSentToSequelize?.data === patientModel.dataValues.data).toBeFalsy();
    });

    it("updates 13 successul to 14 when success", async () => {
      const patient = makePatient();
      patient.data.documentQueryProgress = makeDocumentQueryProgress({
        convert: {
          status: `processing`,
          total: 21,
          successful: 13,
          errors: 0,
        },
      });
      patientModel_findOne.mockResolvedValue({ dataValues: patient });

      const res = await updateConversionProgress({
        patient: { id: uuidv4(), cxId: uuidv4() },
        convertResult: "success",
      });

      // ".mock.calls[0][0]" means the first parameter of the first call to that function
      const patientSentToSequelize = patientModel_update.mock.calls[0]?.[0] as
        | PatientModel
        | undefined;
      expect(patientSentToSequelize).toBeTruthy();
      expect(patientSentToSequelize?.data).toBeTruthy();
      expect(patientSentToSequelize?.data.documentQueryProgress).toBeTruthy();
      expect(patientSentToSequelize?.data.documentQueryProgress?.convert).toBeTruthy();
      expect(patientSentToSequelize?.data.documentQueryProgress?.convert?.successful).toEqual(14);
      expect(res.data.documentQueryProgress?.convert?.successful).toEqual(14);
    });
  });

  describe("calculateConversionProgress", () => {
    const testIt = ({
      result,
      total,
      errors,
      successful,
      count = 1,
      originalStatus,
      expectedStatus,
    }: {
      result: ConvertResult;
      total: number;
      errors?: number;
      successful?: number;
      count?: number;
      originalStatus: DocumentQueryStatus;
      expectedStatus: DocumentQueryStatus;
    }): DocumentQueryProgress => {
      const patient = makePatient({
        id: uuidv4(),
        data: makePatientData({
          documentQueryProgress: { convert: { status: originalStatus, total, errors, successful } },
        }),
      });

      const res = calculateConversionProgress({ patient, convertResult: result, count });

      expect(res).toBeTruthy();
      expect(res.convert).toBeTruthy();
      expect(res.convert?.status).toEqual(expectedStatus);
      expect(res.convert?.total).toEqual(total);
      successful != null
        ? expect(res.convert?.successful).toEqual(successful + (result === "success" ? count : 0))
        : expect(res.convert?.successful).toEqual(0);
      errors != null
        ? expect(res.convert?.errors).toEqual(errors + (result === "failed" ? count : 0))
        : expect(res.convert?.errors).toEqual(0);
      return res;
    };

    describe("success", () => {
      const base = {
        result: "success" as const,
        total: 10,
        originalStatus: "processing" as const,
      };
      it("sets to processing when adding 1 success is lower than total", async () => {
        testIt({ ...base, errors: 1, successful: 7, expectedStatus: "processing" });
      });
      it("sets to completed when adding 1 success matches total", async () => {
        testIt({ ...base, errors: 1, successful: 8, expectedStatus: "completed" });
      });
      it("sets to completed when adding 1 success is higher than total", async () => {
        testIt({ ...base, errors: 1, successful: 9, expectedStatus: "completed" });
      });
      it("sets to completed when no errors and adding 1 success matches total", async () => {
        testIt({ ...base, errors: 0, successful: 9, expectedStatus: "completed" });
      });
      it("sets to processing when has 5 successful and no errors and adding 4 success", async () => {
        testIt({ ...base, errors: 0, successful: 5, expectedStatus: "processing", count: 4 });
      });
      it("sets to completed when has 5 successful and no errors and adding 5 success", async () => {
        testIt({ ...base, errors: 0, successful: 5, expectedStatus: "completed", count: 5 });
      });
    });

    describe("failed", () => {
      const base = {
        result: "failed" as const,
        total: 10,
        originalStatus: "processing" as const,
      };
      it("sets to processing when adding 1 success is lower than total", async () => {
        testIt({ ...base, errors: 1, successful: 7, expectedStatus: "processing" });
      });
      it("sets to completed when adding 1 success matches total", async () => {
        testIt({ ...base, errors: 1, successful: 8, expectedStatus: "completed" });
      });
      it("sets to completed when adding 1 success is higher than total", async () => {
        testIt({ ...base, errors: 1, successful: 9, expectedStatus: "completed" });
      });
      it("sets to completed when no errors and adding 1 success matches total", async () => {
        testIt({ ...base, errors: 0, successful: 9, expectedStatus: "completed" });
      });
      it("sets to processing when has 5 successful and no errors and adding 4 failed", async () => {
        testIt({ ...base, errors: 0, successful: 5, expectedStatus: "processing", count: 4 });
      });
      it("sets to completed when has 5 successful and no errors and adding 5 failed", async () => {
        testIt({ ...base, errors: 0, successful: 5, expectedStatus: "completed", count: 5 });
      });
    });

    describe("from the wild", () => {
      it("sets to completed when success matches total and no errors", async () => {
        testIt({
          result: "success",
          total: 34,
          successful: 34,
          originalStatus: "processing",
          expectedStatus: "completed",
        });
      });
    });
    it("13 success and gets success", async () => {
      const res = testIt({
        result: "success",
        total: 21,
        successful: 13,
        errors: 0,
        originalStatus: "processing",
        expectedStatus: "processing",
      });
      expect(res.convert?.successful).toEqual(14);
    });
  });
});
