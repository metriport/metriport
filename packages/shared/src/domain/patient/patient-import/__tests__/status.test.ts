import { BadRequestError } from "../../../../error/bad-request";
import { PatientImportStatus, validateNewStatus } from "../status";

describe("validateNewStatus", () => {
  describe("new status is waiting", () => {
    describe("throws", () => {
      for (const currentStatus of ["waiting", "processing", "completed", "failed"] as const) {
        it(`throws when updating from ${currentStatus}`, () => {
          expect(() => validateNewStatus(currentStatus, "waiting")).toThrow(BadRequestError);
          expect(() => validateNewStatus(currentStatus, "waiting")).toThrow(
            "Waiting is not a valid status to update"
          );
        });
      }
    });
  });

  describe("new status is processing", () => {
    const destinationStatus = "processing";

    it("allows updating from waiting", () => {
      expect(validateNewStatus("waiting", destinationStatus)).toBe(destinationStatus);
    });

    it("allows updating from processing", () => {
      expect(validateNewStatus("processing", destinationStatus)).toBe(destinationStatus);
    });

    describe("throws", () => {
      for (const currentStatus of ["completed", "failed"] as const) {
        it(`throws when updating from ${currentStatus}`, () => {
          expect(() => validateNewStatus(currentStatus, destinationStatus)).toThrow(
            BadRequestError
          );
          expect(() => validateNewStatus(currentStatus, destinationStatus)).toThrow(
            "Import job is not in a valid state to update to processing"
          );
        });
      }
    });
  });

  describe("new status is completed", () => {
    const destinationStatus = "completed";

    it("allows updating from processing", () => {
      expect(validateNewStatus("processing", destinationStatus)).toBe(destinationStatus);
    });

    it("returns waiting when dry run is true", () => {
      expect(validateNewStatus("processing", destinationStatus, true)).toBe("waiting");
    });

    describe("throws", () => {
      for (const currentStatus of ["waiting", "completed", "failed"] as const) {
        it(`throws when updating from ${currentStatus}`, () => {
          expect(() => validateNewStatus(currentStatus, destinationStatus)).toThrow(
            BadRequestError
          );
          expect(() => validateNewStatus(currentStatus, destinationStatus)).toThrow(
            "Import job is not processing, cannot update to completed"
          );
        });
      }
    });
  });

  describe("new status is failed", () => {
    const destinationStatus = "failed";

    it("allows updating from waiting", () => {
      expect(validateNewStatus("waiting", destinationStatus)).toBe(destinationStatus);
    });

    it("allows updating from processing", () => {
      expect(validateNewStatus("processing", destinationStatus)).toBe(destinationStatus);
    });

    it("allows updating from failed", () => {
      expect(validateNewStatus("failed", destinationStatus)).toBe(destinationStatus);
    });

    describe("throws", () => {
      for (const currentStatus of ["completed"] as const) {
        it(`throws when updating from ${currentStatus}`, () => {
          expect(() => validateNewStatus(currentStatus, destinationStatus)).toThrow(
            BadRequestError
          );
          expect(() => validateNewStatus(currentStatus, destinationStatus)).toThrow(
            "Import job is completed, cannot update to failed"
          );
        });
      }
    });
  });

  describe("new status is invalid", () => {
    it("throws error", () => {
      expect(() => validateNewStatus("processing", "invalid" as PatientImportStatus)).toThrow(
        BadRequestError
      );
      expect(() => validateNewStatus("processing", "invalid" as PatientImportStatus)).toThrow(
        "Invalid import job status"
      );
    });
  });
});
