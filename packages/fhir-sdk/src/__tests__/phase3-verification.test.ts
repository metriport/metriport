import { FhirBundleSdk } from "../index";
import {
  validCompleteBundle,
  bundleWithBrokenReferences,
  bundleWithFullUrlReferences,
} from "./fixtures/fhir-bundles";

describe("Phase 3 Verification - Reference Validation", () => {
  describe("FR-2.1: lookForBrokenReferences() method returns validation result", () => {
    it("should return validation result for valid bundle", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const result = sdk.lookForBrokenReferences();

      expect(result).toBeDefined();
      expect(typeof result.hasBrokenReferences).toBe("boolean");
      expect(Array.isArray(result.brokenReferences)).toBe(true);
    });

    it("should return true for valid references", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const result = sdk.lookForBrokenReferences();

      expect(result.hasBrokenReferences).toBe(false);
      expect(result.brokenReferences).toHaveLength(0);
    });

    it("should return false for invalid references", async () => {
      const sdk = await FhirBundleSdk.create(bundleWithBrokenReferences);
      const result = sdk.lookForBrokenReferences();

      expect(result.hasBrokenReferences).toBe(true);
      expect(result.brokenReferences.length).toBeGreaterThan(0);
    });
  });

  describe("FR-2.2: Validation identifies references by Resource/id pattern and fullUrl references", () => {
    it("should identify Resource/id pattern references", async () => {
      const sdk = await FhirBundleSdk.create(bundleWithBrokenReferences);
      const result = sdk.lookForBrokenReferences();

      const brokenSubjectRef = result.brokenReferences.find(
        ref => ref.reference === "Patient/nonexistent-patient"
      );
      expect(brokenSubjectRef).toBeDefined();
    });

    it("should validate fullUrl references", async () => {
      const sdk = await FhirBundleSdk.create(bundleWithFullUrlReferences);
      const result = sdk.lookForBrokenReferences();

      expect(result.hasBrokenReferences).toBe(false);
    });
  });

  describe("FR-2.3: Validation handles both relative and absolute references", () => {
    it("should handle relative references (Patient/123)", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const result = sdk.lookForBrokenReferences();

      expect(result.hasBrokenReferences).toBe(false);
    });

    it("should handle absolute references (urn:uuid:123)", async () => {
      const sdk = await FhirBundleSdk.create(bundleWithFullUrlReferences);
      const result = sdk.lookForBrokenReferences();

      expect(result.hasBrokenReferences).toBe(false);
    });
  });

  describe("FR-2.4: Validation result includes list of broken references with details", () => {
    it("should provide detailed broken reference information", async () => {
      const sdk = await FhirBundleSdk.create(bundleWithBrokenReferences);
      const result = sdk.lookForBrokenReferences();

      expect(result.brokenReferences.length).toBeGreaterThan(0);
      const brokenRef = result.brokenReferences[0];
      expect(brokenRef).toBeDefined();
      if (brokenRef) {
        expect(brokenRef.sourceResourceId).toBeDefined();
        expect(brokenRef.sourceResourceType).toBeDefined();
        expect(brokenRef.referenceField).toBeDefined();
        expect(brokenRef.reference).toBeDefined();
      }
    });

    it("should identify specific broken reference details", async () => {
      const sdk = await FhirBundleSdk.create(bundleWithBrokenReferences);
      const result = sdk.lookForBrokenReferences();

      const brokenSubjectRef = result.brokenReferences.find(
        ref => ref.reference === "Patient/nonexistent-patient"
      );

      expect(brokenSubjectRef).toBeDefined();
      expect(brokenSubjectRef?.sourceResourceType).toBe("Observation");
      expect(brokenSubjectRef?.referenceField).toContain("subject");
      expect(brokenSubjectRef?.reference).toBe("Patient/nonexistent-patient");
    });
  });

  describe("Edge Cases and Advanced Validation", () => {
    it("should handle empty bundle gracefully", async () => {
      const emptyBundle = { resourceType: "Bundle" as const, type: "collection" as const };
      const sdk = await FhirBundleSdk.create(emptyBundle);
      const result = sdk.lookForBrokenReferences();

      expect(result.hasBrokenReferences).toBe(false);
      expect(result.brokenReferences).toHaveLength(0);
    });

    it("should handle resources without references", async () => {
      const bundleWithoutRefs = {
        resourceType: "Bundle" as const,
        type: "collection" as const,
        entry: [
          {
            resource: {
              resourceType: "Patient" as const,
              id: "test-patient",
              name: [{ family: "Test" }],
            },
          },
        ],
      };

      const sdk = await FhirBundleSdk.create(bundleWithoutRefs);
      const result = sdk.lookForBrokenReferences();

      expect(result.hasBrokenReferences).toBe(false);
      expect(result.brokenReferences).toHaveLength(0);
    });

    it("should handle bundles with some valid and some broken references", async () => {
      const sdk = await FhirBundleSdk.create(bundleWithBrokenReferences);
      const result = sdk.lookForBrokenReferences();

      expect(result.hasBrokenReferences).toBe(true);
      expect(result.brokenReferences.length).toBeGreaterThan(0);
    });
  });

  describe("Performance Requirements", () => {
    it("should validate references efficiently for large bundles", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);

      const start = performance.now();
      const result = sdk.lookForBrokenReferences();
      const end = performance.now();

      expect(result).toBeDefined();
      expect(end - start).toBeLessThan(50); // Should be very fast even for complex bundles
    });
  });
});
