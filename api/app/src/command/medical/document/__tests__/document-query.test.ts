/* eslint-disable @typescript-eslint/no-empty-function */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.test" });
// Keep dotenv import and config before everything else
import { v4 as uuidv4 } from "uuid";
import {
  ConvertResult,
  DocumentQueryStatus,
  Progress,
} from "../../../../domain/medical/document-reference";
import { PatientModel } from "../../../../models/medical/patient";
import { makePatientData } from "../../../../models/medical/__tests__/patient";
import * as transaction from "../../../../models/transaction";
import { getDocQueryProgress, updateDocQuery } from "../document-query";

let startTransaction_mock: jest.SpyInstance;
let patientModel_findOne: jest.SpyInstance;
beforeEach(() => {
  jest.restoreAllMocks();
  startTransaction_mock = jest.spyOn(transaction, "startTransaction");
  patientModel_findOne = jest.spyOn(PatientModel, "findOne");
});

describe("document-query", () => {
  describe("updateDocQuery", () => {
    it("sets download progress completed", async () => {
      const tx = {
        commit: jest.fn(),
        rollback: jest.fn(),
      };
      startTransaction_mock.mockResolvedValue(tx);
      const thePatient = {
        data: {},
      };
      const patient = {
        update: jest.fn(() => {
          return Promise.resolve(thePatient);
        }),
        ...thePatient,
      };
      patientModel_findOne.mockResolvedValue(patient);
      const downloadProgress = { status: "completed" as const };
      const documentQueryProgress = { download: downloadProgress };

      await updateDocQuery({
        patient: { id: "theId", cxId: "theCxId" },
        downloadProgress,
      });

      expect(patient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentQueryProgress,
          }),
        }),
        expect.anything()
      );
    });

    it("sets download progress failed", async () => {
      const tx = {
        commit: jest.fn(),
        rollback: jest.fn(),
      };
      startTransaction_mock.mockResolvedValue(tx);
      const thePatient = {
        data: {},
      };
      const patient = {
        update: jest.fn(() => {
          return Promise.resolve(thePatient);
        }),
        ...thePatient,
      };
      patientModel_findOne.mockResolvedValue(patient);
      const downloadProgress = { status: "failed" as const };
      const documentQueryProgress = { download: downloadProgress };

      await updateDocQuery({
        patient: { id: "theId", cxId: "theCxId" },
        downloadProgress,
      });

      expect(patient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentQueryProgress,
          }),
        }),
        expect.anything()
      );
    });
  });

  describe("getDocQueryProgress", () => {
    const testIt = ({
      result,
      total,
      errors,
      successful,
      originalStatus,
      expectedStatus,
    }: {
      result: ConvertResult;
      total: number;
      errors?: number;
      successful?: number;
      originalStatus: DocumentQueryStatus;
      expectedStatus: DocumentQueryStatus;
    }) => {
      const patient = {
        id: uuidv4(),
        data: makePatientData(),
      };
      const convertProgress: Progress = {
        status: originalStatus,
        total,
        errors,
        successful,
      };

      const res = getDocQueryProgress({
        patient,
        convertProgress,
        convertResult: result,
      });

      expect(res).toBeTruthy();
      expect(res.convert).toBeTruthy();
      expect(res.convert?.status).toEqual(expectedStatus);
      expect(res.convert?.total).toEqual(total);
      successful
        ? expect(res.convert?.successful).toEqual(successful + (result === "success" ? 1 : 0))
        : expect(res.convert?.successful).toBeUndefined();
      expect(res.convert?.successful).toEqual((successful ?? 0) + (result === "success" ? 1 : 0));
      errors != null
        ? expect(res.convert?.errors).toEqual(errors + (result === "failed" ? 1 : 0))
        : expect(res.convert?.errors).toBeUndefined();
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
  });
});
