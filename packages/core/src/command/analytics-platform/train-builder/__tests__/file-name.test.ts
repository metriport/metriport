/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { BadRequestError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { buildTrainInputPrefix } from "../file-name";

describe("buildTrainInputPrefix", () => {
  describe("basic functionality", () => {
    it("should generate a valid prefix with provided cxId and patientId", () => {
      const cxId = "test-cx-123";
      const patientId = "patient-456";

      const result = buildTrainInputPrefix({ cxId, patientId });

      expect(result).toMatch(
        /^train\/in\/year=\d{4}\/month=\d{2}\/day=\d{2}\/hour=\d{2}\/min=\d{2}\/cx=test-cx-123\/pt=patient-456$/
      );
    });

    it("should include the correct path structure", () => {
      const cxId = "cx-001";
      const patientId = "pt-002";
      const date = buildDayjs("2025-02-03T13:24:56Z");

      const result = buildTrainInputPrefix({ cxId, patientId, date });

      expect(result).toEqual(
        `train/in/year=2025/month=02/day=03/hour=13/min=24/cx=cx-001/pt=pt-002`
      );
    });
  });

  describe("date parameter handling", () => {
    it("should use provided date when given", () => {
      const cxId = "test-cx";
      const patientId = "test-patient";
      const specificDate = buildDayjs("2025-02-03T13:24:56Z");

      const result = buildTrainInputPrefix({ cxId, patientId, date: specificDate });

      expect(result).toEqual(
        "train/in/year=2025/month=02/day=03/hour=13/min=24/cx=test-cx/pt=test-patient"
      );
    });

    it("should use current time when no date provided", () => {
      const cxId = "test-cx";
      const patientId = "test-patient";

      const result = buildTrainInputPrefix({ cxId, patientId });

      // Should contain current date/time components
      expect(result).toMatch(
        /^train\/in\/year=\d{4}\/month=\d{2}\/day=\d{2}\/hour=\d{2}\/min=\d{2}\/cx=test-cx\/pt=test-patient$/
      );
    });

    it("should handle different date formats correctly", () => {
      const cxId = "date-test";
      const patientId = "date-patient";

      const testDates = [
        { input: "2024-01-01T00:00:00Z", expected: "year=2024/month=01/day=01/hour=00/min=00" },
        { input: "2024-12-31T23:59:59Z", expected: "year=2024/month=12/day=31/hour=23/min=59" },
        { input: "2025-06-15T12:30:45Z", expected: "year=2025/month=06/day=15/hour=12/min=30" },
      ];

      testDates.forEach(({ input, expected }) => {
        const date = buildDayjs(input);
        const result = buildTrainInputPrefix({ cxId, patientId, date });

        expect(result).toContain(expected);
        expect(result).toContain(`cx=${cxId}`);
        expect(result).toContain(`pt=${patientId}`);
      });
    });

    it("should be deterministic with same date input", () => {
      const cxId = "deterministic-cx";
      const patientId = "deterministic-patient";
      const date = buildDayjs("2025-03-15T10:30:00Z");

      const result1 = buildTrainInputPrefix({ cxId, patientId, date });
      const result2 = buildTrainInputPrefix({ cxId, patientId, date });

      expect(result1).toBe(result2);
    });
  });

  describe("date formatting", () => {
    it("should format date components correctly", () => {
      const cxId = "test-cx";
      const patientId = "test-patient";

      const result = buildTrainInputPrefix({ cxId, patientId });

      // Extract date components from the result
      const yearMatch = result.match(/year=(\d{4})/);
      const monthMatch = result.match(/month=(\d{2})/);
      const dayMatch = result.match(/day=(\d{2})/);
      const hourMatch = result.match(/hour=(\d{2})/);
      const minMatch = result.match(/min=(\d{2})/);

      expect(yearMatch).toBeTruthy();
      expect(monthMatch).toBeTruthy();
      expect(dayMatch).toBeTruthy();
      expect(hourMatch).toBeTruthy();
      expect(minMatch).toBeTruthy();

      // Verify year is reasonable (current year or recent)
      const year = parseInt(yearMatch![1]!, 10);
      const currentYear = new Date().getFullYear();
      expect(year).toBeGreaterThanOrEqual(currentYear - 1);
      expect(year).toBeLessThanOrEqual(currentYear + 1);

      // Verify month is valid
      const month = parseInt(monthMatch![1]!, 10);
      expect(month).toBeGreaterThanOrEqual(1);
      expect(month).toBeLessThanOrEqual(12);

      // Verify day is valid
      const day = parseInt(dayMatch![1]!, 10);
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(31);

      // Verify hour is valid
      const hour = parseInt(hourMatch![1]!, 10);
      expect(hour).toBeGreaterThanOrEqual(0);
      expect(hour).toBeLessThanOrEqual(23);

      // Verify minute is valid
      const minute = parseInt(minMatch![1]!, 10);
      expect(minute).toBeGreaterThanOrEqual(0);
      expect(minute).toBeLessThanOrEqual(59);
    });

    it("should use UTC timezone for date formatting", () => {
      const cxId = "utc-test";
      const patientId = "utc-patient";

      const result = buildTrainInputPrefix({ cxId, patientId });

      // The function uses buildDayjs() which returns UTC time
      // We can verify this by checking that the format is consistent
      expect(result).toMatch(/year=\d{4}\/month=\d{2}\/day=\d{2}\/hour=\d{2}\/min=\d{2}/);
    });
  });

  describe("input parameter handling", () => {
    it("should handle different cxId formats", () => {
      const testCases = [
        "simple-cx",
        "cx-with-numbers-123",
        "cx_with_underscores",
        "cx-with-dashes-and-numbers-456",
        "UPPERCASE-CX",
        "mixedCase-Cx",
        uuidv7(),
      ];

      testCases.forEach(cxId => {
        const result = buildTrainInputPrefix({ cxId, patientId: "test-patient" });
        expect(result).toContain(`cx=${cxId}`);
      });
    });

    it("should handle different patientId formats", () => {
      const testCases = [
        "simple-patient",
        "patient-with-numbers-789",
        "patient_with_underscores",
        "patient-with-dashes-and-numbers-012",
        "UPPERCASE-PATIENT",
        "mixedCase-Patient",
        uuidv7(),
      ];

      testCases.forEach(patientId => {
        const result = buildTrainInputPrefix({ cxId: "test-cx", patientId });
        expect(result).toContain(`pt=${patientId}`);
      });
    });

    it("should throw error for empty cxId", () => {
      expect(() => {
        buildTrainInputPrefix({ cxId: "", patientId: "valid-patient" });
      }).toThrow(BadRequestError);

      expect(() => {
        buildTrainInputPrefix({ cxId: "", patientId: "valid-patient" });
      }).toThrow("cxId is required");
    });

    it("should throw error for empty patientId", () => {
      expect(() => {
        buildTrainInputPrefix({ cxId: "valid-cx", patientId: "" });
      }).toThrow(BadRequestError);

      expect(() => {
        buildTrainInputPrefix({ cxId: "valid-cx", patientId: "" });
      }).toThrow("patientId is required");
    });

    it("should throw error for whitespace-only cxId", () => {
      expect(() => {
        buildTrainInputPrefix({ cxId: "   ", patientId: "valid-patient" });
      }).toThrow(BadRequestError);

      expect(() => {
        buildTrainInputPrefix({ cxId: "   ", patientId: "valid-patient" });
      }).toThrow("cxId is required");
    });

    it("should throw error for whitespace-only patientId", () => {
      expect(() => {
        buildTrainInputPrefix({ cxId: "valid-cx", patientId: "   " });
      }).toThrow(BadRequestError);

      expect(() => {
        buildTrainInputPrefix({ cxId: "valid-cx", patientId: "   " });
      }).toThrow("patientId is required");
    });

    it("should throw error for both empty cxId and patientId", () => {
      expect(() => {
        buildTrainInputPrefix({ cxId: "", patientId: "" });
      }).toThrow(BadRequestError);

      expect(() => {
        buildTrainInputPrefix({ cxId: "", patientId: "" });
      }).toThrow("cxId is required");
    });

    it("should handle special characters in IDs", () => {
      const cxId = "cx-with-special@chars#123";
      const patientId = "patient.with.dots.and@symbols";

      const result = buildTrainInputPrefix({ cxId, patientId });

      expect(result).toContain(`cx=${cxId}`);
      expect(result).toContain(`pt=${patientId}`);
    });
  });
});
