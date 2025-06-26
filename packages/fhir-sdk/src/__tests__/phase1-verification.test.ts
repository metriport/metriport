import { FhirBundleSdk } from "../index";
import {
  validCompleteBundle,
  bundleWithFullUrlReferences,
  emptyBundle,
} from "./fixtures/fhir-bundles";
import { Patient, Practitioner, Observation } from "@medplum/fhirtypes";

describe("Phase 1 Verification - Bundle Initialization & Resource Retrieval", () => {
  describe("Bundle Initialization", () => {
    it("should initialize with valid bundle and build indexes", () => {
      const sdk = new FhirBundleSdk(validCompleteBundle);
      expect(sdk).toBeDefined();
    });

    it("should handle empty bundle", () => {
      const sdk = new FhirBundleSdk(emptyBundle);
      expect(sdk).toBeDefined();
    });
  });

  describe("Resource Retrieval by ID - FR-3.1 to FR-3.5", () => {
    let sdk: FhirBundleSdk;

    beforeEach(() => {
      sdk = new FhirBundleSdk(validCompleteBundle);
    });

    describe("FR-3.1: getResourceById<T>(id: string): T | undefined returns resource matching the ID", () => {
      it("should return resource by ID with proper typing", () => {
        const patient = sdk.getResourceById<Patient>("patient-123");

        expect(patient).toBeDefined();
        expect(patient?.id).toBe("patient-123");
        expect(patient?.resourceType).toBe("Patient");
        expect(patient?.name?.[0]?.family).toBe("Doe");
      });

      it("should return practitioner by ID", () => {
        const practitioner = sdk.getResourceById<Practitioner>("practitioner-456");

        expect(practitioner).toBeDefined();
        expect(practitioner?.id).toBe("practitioner-456");
        expect(practitioner?.resourceType).toBe("Practitioner");
        expect(practitioner?.name?.[0]?.family).toBe("Smith");
      });

      it("should return observation by ID", () => {
        const observation = sdk.getResourceById<Observation>("observation-001");

        expect(observation).toBeDefined();
        expect(observation?.id).toBe("observation-001");
        expect(observation?.resourceType).toBe("Observation");
        expect(observation?.code?.text).toBe("Glucose");
      });
    });

    describe("FR-3.2: Method searches both resource.id and entry.fullUrl for matches", () => {
      it("should find resource by resource.id", () => {
        const patient = sdk.getResourceById<Patient>("patient-123");
        expect(patient?.id).toBe("patient-123");
      });

      it("should find resource by fullUrl", () => {
        const patient = sdk.getResourceById<Patient>("urn:uuid:patient-123");
        expect(patient?.id).toBe("patient-123");
      });
    });

    describe("FR-3.3: Method supports type parameter for proper TypeScript return typing", () => {
      it("should return properly typed resource", () => {
        const patient = sdk.getResourceById<Patient>("patient-123");

        // TypeScript should infer this as Patient | undefined
        // These properties should be available without type errors
        expect(patient?.name).toBeDefined();
        expect(patient?.birthDate).toBeDefined();
        expect(patient?.gender).toBe("female");
      });
    });

    describe("FR-3.4: Method returns undefined if resource not found", () => {
      it("should return undefined for nonexistent resource", () => {
        const result = sdk.getResourceById<Patient>("nonexistent-id");
        expect(result).toBeUndefined();
      });

      it("should return undefined for empty string", () => {
        const result = sdk.getResourceById<Patient>("");
        expect(result).toBeUndefined();
      });
    });

    describe("FR-3.5: Lookup operates in O(1) time complexity", () => {
      it("should perform lookup in O(1) time", () => {
        const start = performance.now();
        const patient = sdk.getResourceById<Patient>("patient-123");
        const end = performance.now();

        expect(patient).toBeDefined();
        // O(1) lookup should be very fast (under 1ms)
        expect(end - start).toBeLessThan(1);
      });

      it("should maintain O(1) performance for multiple lookups", () => {
        const start = performance.now();

        // Perform multiple lookups
        sdk.getResourceById<Patient>("patient-123");
        sdk.getResourceById<Practitioner>("practitioner-456");
        sdk.getResourceById<Observation>("observation-001");
        sdk.getResourceById<Patient>("nonexistent-id");

        const end = performance.now();

        // Multiple O(1) lookups should still be very fast
        expect(end - start).toBeLessThan(5);
      });
    });
  });

  describe("FullUrl Reference Handling", () => {
    it("should handle fullUrl references correctly", () => {
      const sdk = new FhirBundleSdk(bundleWithFullUrlReferences);

      // Should find by resource.id
      const patient1 = sdk.getResourceById<Patient>("patient-fullurl");
      expect(patient1).toBeDefined();
      expect(patient1?.id).toBe("patient-fullurl");

      // Should find by fullUrl
      const patient2 = sdk.getResourceById<Patient>("urn:uuid:patient-fullurl");
      expect(patient2).toBeDefined();
      expect(patient2?.id).toBe("patient-fullurl");

      // Should be the same object
      expect(patient1).toBe(patient2);
    });
  });

  describe("Edge Cases", () => {
    it("should handle bundle with no entries", () => {
      const sdk = new FhirBundleSdk(emptyBundle);
      const result = sdk.getResourceById<Patient>("any-id");
      expect(result).toBeUndefined();
    });

    it("should handle resources without IDs", () => {
      const bundleWithoutIds = {
        resourceType: "Bundle" as const,
        type: "collection" as const,
        total: 1,
        entry: [
          {
            fullUrl: "urn:uuid:no-id-resource",
            resource: {
              resourceType: "Patient" as const,
              // No id field
              name: [{ family: "NoId", given: ["Patient"] }],
            },
          },
        ],
      };

      const sdk = new FhirBundleSdk(bundleWithoutIds);

      // Should find by fullUrl even without resource.id
      const patient = sdk.getResourceById<Patient>("urn:uuid:no-id-resource");
      expect(patient).toBeDefined();
      expect(patient?.name?.[0]?.family).toBe("NoId");
    });
  });
});
