/* eslint-disable @typescript-eslint/no-empty-function */
import { Progress, ProgressType } from "@metriport/core/domain/document-query";
import { PatientExternalData } from "@metriport/core/domain/patient";
import { makePatient, makePatientData } from "@metriport/core/domain/__tests__/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { v4 as uuidv4 } from "uuid";
import { DynamicProgress, setHIETallyCount } from "../tally-doc-query-progress";

describe("tallyDocQueryProgress", () => {
  describe("setHIETallyCount", () => {
    const testIt = ({
      existingProgress,
      inputProgress,
      expectedProgress,
      type = "convert",
      source = MedicalDataSource.COMMONWELL,
    }: {
      existingProgress?: Progress;
      inputProgress: DynamicProgress;
      type?: ProgressType;
      source?: MedicalDataSource;
      expectedProgress: Progress;
    }): PatientExternalData => {
      const patient = makePatient({
        id: uuidv4(),
        data: makePatientData({
          externalData: {
            [source]: {
              documentQueryProgress: {
                [type]: existingProgress,
              },
            },
          },
        }),
      });

      const res = setHIETallyCount(patient, inputProgress, type, source);
      const sourceData = res[source];
      expect(sourceData).toBeTruthy();
      expect(sourceData?.documentQueryProgress).toBeTruthy();
      expect(sourceData?.documentQueryProgress?.[type]).toBeTruthy();
      expect(sourceData?.documentQueryProgress?.[type]?.status).toEqual(expectedProgress.status);
      expect(sourceData?.documentQueryProgress?.[type]?.total).toEqual(expectedProgress.total);
      return res;
    };

    it("keeps processing when adding 1 success is lower than total", async () => {
      const existingProgress: Progress = {
        status: "processing",
        total: 10,
        errors: 0,
        successful: 8,
      };
      const inputProgress = { successful: 1 };
      const expectedProgress: Progress = {
        status: "processing",
        total: 10,
        errors: 0,
        successful: 1,
      };
      testIt({ existingProgress, inputProgress, expectedProgress });
    });

    it("sets to completed when adding 1 success is equal to total", async () => {
      const existingProgress: Progress = {
        status: "processing",
        total: 10,
        errors: 0,
        successful: 9,
      };
      const inputProgress = { successful: 1 };
      const expectedProgress: Progress = {
        status: "completed",
        total: 10,
        errors: 0,
        successful: 10,
      };
      testIt({ existingProgress, inputProgress, expectedProgress });
    });

    it("keeps processing when adding success with existing errors", async () => {
      const existingProgress: Progress = {
        status: "processing",
        total: 10,
        errors: 2,
        successful: 5,
      };
      const inputProgress = { successful: 2 };
      const expectedProgress: Progress = {
        status: "processing",
        total: 10,
        errors: 2,
        successful: 7,
      };
      testIt({ existingProgress, inputProgress, expectedProgress });
    });

    it("sets to completed when success + errors equals total", async () => {
      const existingProgress: Progress = {
        status: "processing",
        total: 10,
        errors: 3,
        successful: 6,
      };
      const inputProgress = { successful: 1 };
      const expectedProgress: Progress = {
        status: "completed",
        total: 10,
        errors: 3,
        successful: 7,
      };
      testIt({ existingProgress, inputProgress, expectedProgress });
    });

    it("handles multiple successes in input", async () => {
      const existingProgress: Progress = {
        status: "processing",
        total: 10,
        errors: 0,
        successful: 5,
      };
      const inputProgress = { successful: 3 };
      const expectedProgress: Progress = {
        status: "processing",
        total: 10,
        errors: 0,
        successful: 8,
      };
      testIt({ existingProgress, inputProgress, expectedProgress });
    });

    it("handles both success and errors in input", async () => {
      const existingProgress: Progress = {
        status: "processing",
        total: 10,
        errors: 1,
        successful: 5,
      };
      const inputProgress = { successful: 2, errors: 2 };
      const expectedProgress: Progress = {
        status: "completed",
        total: 10,
        errors: 3,
        successful: 7,
      };
      testIt({ existingProgress, inputProgress, expectedProgress });
    });

    it("handles empty existing progress", async () => {
      const existingProgress = undefined;
      const inputProgress = { successful: 1 };
      const expectedProgress: Progress = {
        status: "completed",
        total: 0,
        errors: 0,
        successful: 1,
      };
      testIt({ existingProgress, inputProgress, expectedProgress });
    });
  });
});
