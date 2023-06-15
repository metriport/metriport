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
import { PatientData, PatientModel } from "../../../../models/medical/patient";
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
    const tx = {
      commit: jest.fn(),
      rollback: jest.fn(),
    };
    let patientModel_update: jest.SpyInstance;
    beforeEach(() => {
      startTransaction_mock.mockResolvedValue(tx);
      patientModel_update = jest.spyOn(PatientModel, "update").mockImplementation(async () => [1]);
    });
    it("sets download progress completed", async () => {
      const patient = { data: {} };
      patientModel_findOne.mockResolvedValue(patient);
      const downloadProgress = { status: "completed" as const };
      const documentQueryProgress = { download: downloadProgress };

      await updateDocQuery({
        patient: { id: "theId", cxId: "theCxId" },
        downloadProgress,
      });

      expect(patientModel_update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentQueryProgress,
          }),
        }),
        expect.anything()
      );
    });

    it("sets download progress failed", async () => {
      const patient = { data: {} };
      patientModel_findOne.mockResolvedValue(patient);
      const downloadProgress = { status: "failed" as const };
      const documentQueryProgress = { download: downloadProgress };

      await updateDocQuery({
        patient: { id: "theId", cxId: "theCxId" },
        downloadProgress,
      });

      expect(patientModel_update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentQueryProgress,
          }),
        }),
        expect.anything()
      );
    });

    it("send a modified object to Sequelize", async () => {
      const data: PatientData = makePatientData();
      const patient = { data };
      patientModel_findOne.mockResolvedValue(patient);
      const downloadProgress = { status: "failed" as const };

      await updateDocQuery({
        patient: { id: "theId", cxId: "theCxId" },
        downloadProgress,
      });

      // ".mock.calls[0][0]" means the first parameter of the first call to that function
      const patientSentToSequelize = patientModel_update.mock.calls[0]?.[0] as
        | PatientModel
        | undefined;
      expect(patientSentToSequelize).toBeTruthy();
      expect(patientSentToSequelize === patient).toBeFalsy();
      const docProgress = patientSentToSequelize?.data;
      expect(docProgress).toBeTruthy();
      expect(docProgress === data).toBeFalsy();
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
      successful != null
        ? expect(res.convert?.successful).toEqual(successful + (result === "success" ? 1 : 0))
        : expect(res.convert?.successful).toEqual(0);
      errors != null
        ? expect(res.convert?.errors).toEqual(errors + (result === "failed" ? 1 : 0))
        : expect(res.convert?.errors).toEqual(0);
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
