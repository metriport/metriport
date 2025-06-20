import { bulkPatientCohortSchema } from "../patient-cohort";

describe("bulkPatientCohortSchema", () => {
  describe("valid cases", () => {
    it("should validate with patientIds only", () => {
      const validData = {
        patientIds: ["patient-1", "patient-2", "patient-3"],
      };

      const result = bulkPatientCohortSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should validate with all only", () => {
      const validData = {
        all: true,
      };

      const result = bulkPatientCohortSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should validate when both patientIds and all (false) are provided", () => {
      const validData = {
        patientIds: ["patient-1"],
        all: false,
      };

      const result = bulkPatientCohortSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe("mutual exclusivity", () => {
    it("should reject when both patientIds and all (true) are provided", () => {
      const invalidData = {
        patientIds: ["patient-1"],
        all: true,
      };

      const result = bulkPatientCohortSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "patientIds and all cannot be provided together"
        );
      }
    });
  });

  describe("required field validation", () => {
    it("should reject when neither patientIds nor all is provided", () => {
      const invalidData = {};

      const result = bulkPatientCohortSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Either patientIds or all must be provided");
      }
    });

    it("should reject when patientIds is empty array", () => {
      const invalidData = {
        patientIds: [],
      };

      const result = bulkPatientCohortSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("patientIds must be an array of patient IDs");
      }
    });
  });

  describe("data type validation", () => {
    it("should reject when patientIds contains non-string values", () => {
      const invalidData = {
        patientIds: ["patient-1", 123, "patient-3"],
      };

      const result = bulkPatientCohortSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Expected string, received number");
      }
    });

    it("should reject when all is not a boolean", () => {
      const invalidData = {
        all: "true",
      };

      const result = bulkPatientCohortSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Expected boolean, received string");
      }
    });
  });
});
