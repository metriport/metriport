import { FhirBundleSdk } from "../index";
import {
  validCompleteBundle,
  mixedResourceTypesBundle,
  patientsOnlyBundle,
  bundleWithFullUrlReferences,
} from "./fixtures/fhir-bundles";

describe("Phase 4 Verification - Bundle Export Functionality", () => {
  describe("FR-6.1: exportSubset(resourceIds: string[]): Bundle creates new bundle with specified resources", () => {
    it("should export subset of resources by ID", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const resourceIds = ["patient-123", "observation-001"];

      const exportedBundle = sdk.exportSubset(resourceIds);

      expect(exportedBundle).toBeDefined();
      expect(exportedBundle.resourceType).toBe("Bundle");
      expect(exportedBundle.entry).toHaveLength(2);

      const patientEntry = exportedBundle.entry?.find(e => e.resource?.resourceType === "Patient");
      const observationEntry = exportedBundle.entry?.find(
        e => e.resource?.resourceType === "Observation"
      );

      expect(patientEntry?.resource?.id).toBe("patient-123");
      expect(observationEntry?.resource?.id).toBe("observation-001");
    });

    it("should handle subset with some nonexistent resources (FR-6.5)", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const resourceIds = ["patient-123", "nonexistent-id", "observation-001"];

      const exportedBundle = sdk.exportSubset(resourceIds);

      expect(exportedBundle.entry).toHaveLength(2); // Only existing resources included

      const patientEntry = exportedBundle.entry?.find(e => e.resource?.resourceType === "Patient");
      const observationEntry = exportedBundle.entry?.find(
        e => e.resource?.resourceType === "Observation"
      );

      expect(patientEntry?.resource?.id).toBe("patient-123");
      expect(observationEntry?.resource?.id).toBe("observation-001");
    });

    it("should handle empty resource ID list", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const exportedBundle = sdk.exportSubset([]);

      expect(exportedBundle.entry).toHaveLength(0);
      expect(exportedBundle.total).toBe(0);
    });

    it("should handle all nonexistent resource IDs", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const exportedBundle = sdk.exportSubset(["nonexistent-1", "nonexistent-2"]);

      expect(exportedBundle.entry).toHaveLength(0);
      expect(exportedBundle.total).toBe(0);
    });
  });

  describe("FR-6.2: exportByType(resourceType: string): Bundle creates new bundle with all resources of specified type", () => {
    it("should export all resources of specified type", async () => {
      const sdk = await FhirBundleSdk.create(mixedResourceTypesBundle);
      const exportedBundle = sdk.exportByType("Patient");

      expect(exportedBundle).toBeDefined();
      expect(exportedBundle.resourceType).toBe("Bundle");
      expect(exportedBundle.entry?.length).toBeGreaterThan(0);

      // All entries should be Patient resources
      exportedBundle.entry?.forEach(entry => {
        expect(entry.resource?.resourceType).toBe("Patient");
      });
    });

    it("should return empty bundle for nonexistent resource type", async () => {
      const sdk = await FhirBundleSdk.create(patientsOnlyBundle);
      const exportedBundle = sdk.exportByType("Observation");

      expect(exportedBundle.entry).toHaveLength(0);
      expect(exportedBundle.total).toBe(0);
    });

    it("should export all observations from mixed bundle", async () => {
      const sdk = await FhirBundleSdk.create(mixedResourceTypesBundle);
      const exportedBundle = sdk.exportByType("Observation");

      expect(exportedBundle.entry?.length).toBeGreaterThan(0);
      exportedBundle.entry?.forEach(entry => {
        expect(entry.resource?.resourceType).toBe("Observation");
      });
    });
  });

  describe("FR-6.3: exportByTypes(resourceTypes: string[]): Bundle creates new bundle with all resources of specified types", () => {
    it("should export all resources of specified types", async () => {
      const sdk = await FhirBundleSdk.create(mixedResourceTypesBundle);
      const exportedBundle = sdk.exportByTypes(["Patient", "Observation"]);

      expect(exportedBundle).toBeDefined();
      expect(exportedBundle.entry?.length).toBeGreaterThan(0);

      // All entries should be either Patient or Observation resources
      exportedBundle.entry?.forEach(entry => {
        expect(["Patient", "Observation"]).toContain(entry.resource?.resourceType);
      });
    });

    it("should handle empty resource types array", async () => {
      const sdk = await FhirBundleSdk.create(mixedResourceTypesBundle);
      const exportedBundle = sdk.exportByTypes([]);

      expect(exportedBundle.entry).toHaveLength(0);
      expect(exportedBundle.total).toBe(0);
    });

    it("should handle mix of existing and nonexistent resource types", async () => {
      const sdk = await FhirBundleSdk.create(patientsOnlyBundle);
      const exportedBundle = sdk.exportByTypes(["Patient", "Observation", "Encounter"]);

      expect(exportedBundle.entry?.length).toBeGreaterThan(0);
      exportedBundle.entry?.forEach(entry => {
        expect(entry.resource?.resourceType).toBe("Patient");
      });
    });
  });

  describe("FR-6.4: Exported bundles maintain original bundle metadata but update total count", () => {
    it("should maintain original bundle metadata", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const exportedBundle = sdk.exportSubset(["patient-123"]);

      expect(exportedBundle.resourceType).toBe("Bundle");
      expect(exportedBundle.type).toBe(validCompleteBundle.type);

      // Preserve original bundle metadata if it exists
      if (validCompleteBundle.id) {
        expect(exportedBundle.id).toBe(validCompleteBundle.id);
      }
      if (validCompleteBundle.meta) {
        expect(exportedBundle.meta).toEqual(validCompleteBundle.meta);
      }
      if (validCompleteBundle.timestamp) {
        expect(exportedBundle.timestamp).toBe(validCompleteBundle.timestamp);
      }
    });

    it("should update total count correctly", async () => {
      const sdk = await FhirBundleSdk.create(mixedResourceTypesBundle);
      const exportedBundle = sdk.exportByType("Patient");

      expect(exportedBundle.total).toBe(exportedBundle.entry?.length);
      expect(exportedBundle.total).toBeGreaterThan(0);
    });

    it("should set total to 0 for empty exports", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const exportedBundle = sdk.exportSubset([]);

      expect(exportedBundle.total).toBe(0);
      expect(exportedBundle.entry).toHaveLength(0);
    });
  });

  describe("FR-6.6: Exported bundles preserve original entry.fullUrl values", () => {
    it("should preserve fullUrl values in exported entries", async () => {
      const sdk = await FhirBundleSdk.create(bundleWithFullUrlReferences);
      const exportedBundle = sdk.exportSubset(["patient-fullurl"]);

      expect(exportedBundle.entry).toHaveLength(1);
      const entry = exportedBundle.entry?.[0];

      expect(entry?.fullUrl).toBeDefined();
      expect(entry?.fullUrl).toContain("urn:uuid:");
    });

    it("should maintain fullUrl consistency across export types", async () => {
      const sdk = await FhirBundleSdk.create(bundleWithFullUrlReferences);
      const exportBySubset = sdk.exportSubset(["patient-fullurl"]);
      const exportByType = sdk.exportByType("Patient");

      const subsetEntry = exportBySubset.entry?.[0];
      const typeEntry = exportByType.entry?.find(e => e.resource?.id === "patient-fullurl");

      expect(subsetEntry?.fullUrl).toBe(typeEntry?.fullUrl);
    });
  });

  describe("Performance and Edge Cases", () => {
    it("should handle large resource lists efficiently", async () => {
      const sdk = await FhirBundleSdk.create(mixedResourceTypesBundle);

      const start = performance.now();
      const exportedBundle = sdk.exportByTypes(["Patient", "Observation", "Encounter"]);
      const end = performance.now();

      expect(exportedBundle).toBeDefined();
      expect(end - start).toBeLessThan(50); // Should be efficient
    });

    it("should handle bundles with undefined entries", async () => {
      const emptyBundle = { resourceType: "Bundle" as const, type: "collection" as const };
      const sdk = await FhirBundleSdk.create(emptyBundle);

      const exportedBundle = sdk.exportSubset(["any-id"]);

      expect(exportedBundle.entry).toHaveLength(0);
      expect(exportedBundle.total).toBe(0);
    });

    it("should return new bundle instances, not references", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const exportedBundle1 = sdk.exportSubset(["patient-123"]);
      const exportedBundle2 = sdk.exportSubset(["patient-123"]);

      expect(exportedBundle1).not.toBe(exportedBundle2);
      expect(exportedBundle1.entry).not.toBe(exportedBundle2.entry);
    });
  });
});
