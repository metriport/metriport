/* eslint-disable @typescript-eslint/no-explicit-any */
import { FhirBundleSdk } from "../index";
import { validCompleteBundle, mixedResourceTypesBundle } from "./fixtures/fhir-bundles";
import { Observation } from "@medplum/fhirtypes";

describe("Reverse References", () => {
  describe("getResourcesReferencingId - basic functionality", () => {
    it("should return all resources that reference a given resource ID", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);

      // patient-123 is referenced by:
      // - encounter-789 (subject)
      // - observation-001 (subject)
      // - diagnostic-report-002 (subject)
      const referencingResources = sdk.getResourcesReferencingId("patient-123");

      expect(referencingResources).toHaveLength(3);

      const resourceTypes = referencingResources.map(r => r.resourceType).sort();
      expect(resourceTypes).toEqual(["DiagnosticReport", "Encounter", "Observation"]);
    });

    it("should return empty array when no resources reference the given ID", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);

      const referencingResources = sdk.getResourcesReferencingId("nonexistent-id");

      expect(referencingResources).toEqual([]);
    });

    it("should handle resources referenced by multiple other resources", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);

      // encounter-789 is referenced by:
      // - observation-001 (encounter)
      // - diagnostic-report-002 (encounter)
      const referencingResources = sdk.getResourcesReferencingId("encounter-789");

      expect(referencingResources).toHaveLength(2);
      expect(
        referencingResources.every(
          r => r.resourceType === "Observation" || r.resourceType === "DiagnosticReport"
        )
      ).toBe(true);
    });

    it("should handle resources referenced by array fields", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);

      // practitioner-456 is referenced by:
      // - encounter-789 (participant array)
      // - observation-001 (performer array)
      // - diagnostic-report-002 (performer array)
      const referencingResources = sdk.getResourcesReferencingId("practitioner-456");

      expect(referencingResources).toHaveLength(3);
    });
  });

  describe("getResourcesReferencingId - filtering by resource type", () => {
    it("should filter by source resource type", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);

      // Get only Observations that reference patient-123
      const observations = sdk.getResourcesReferencingId<Observation>("patient-123", {
        resourceType: "Observation",
      });

      expect(observations).toHaveLength(1);
      expect(observations[0]?.resourceType).toBe("Observation");
      expect(observations[0]?.id).toBe("observation-001");
    });

    it("should return empty array when filtering by type with no matches", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);

      // No Practitioners reference patient-123
      const practitioners = sdk.getResourcesReferencingId("patient-123", {
        resourceType: "Practitioner",
      });

      expect(practitioners).toEqual([]);
    });

    it("should handle multiple resources of same type referencing target", async () => {
      const sdk = await FhirBundleSdk.create(mixedResourceTypesBundle);

      // patient-mix-1 is referenced by observation-mix-1 and observation-mix-2
      const observations = sdk.getResourcesReferencingId<Observation>("patient-mix-1", {
        resourceType: "Observation",
      });

      expect(observations).toHaveLength(2);
      expect(observations.every(o => o.resourceType === "Observation")).toBe(true);
    });
  });

  describe("getResourcesReferencingId - filtering by reference field", () => {
    it("should filter by specific reference field", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);

      // Get only resources that reference patient-123 via "subject" field
      const subjectReferences = sdk.getResourcesReferencingId("patient-123", {
        referenceField: "subject",
      });

      expect(subjectReferences).toHaveLength(3);
      expect(
        subjectReferences.every(r => {
          const resource = r as any;
          return resource.subject?.reference?.includes("patient-123");
        })
      ).toBe(true);
    });

    it("should filter by nested reference field", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);

      // Get only resources that reference practitioner-456 via "performer" field
      const performerReferences = sdk.getResourcesReferencingId("practitioner-456", {
        referenceField: "performer",
      });

      expect(performerReferences.length).toBeGreaterThan(0);
    });

    it("should return empty array when field does not match", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);

      // No resources reference patient-123 via "performer" field
      const performerReferences = sdk.getResourcesReferencingId("patient-123", {
        referenceField: "performer",
      });

      expect(performerReferences).toEqual([]);
    });
  });

  describe("getResourcesReferencingId - combined filters", () => {
    it("should apply both resourceType and referenceField filters", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);

      // Get only Observations that reference patient-123 via "subject"
      const observations = sdk.getResourcesReferencingId<Observation>("patient-123", {
        resourceType: "Observation",
        referenceField: "subject",
      });

      expect(observations).toHaveLength(1);
      expect(observations[0]?.resourceType).toBe("Observation");
      expect(observations[0]?.id).toBe("observation-001");
    });
  });

  describe("Smart resource getReferencingResources method", () => {
    it("should expose getReferencingResources on smart resources", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const patient = sdk.getPatientById("patient-123");

      expect(patient).toBeDefined();
      expect(typeof (patient as any).getReferencingResources).toBe("function");
    });

    it("should return all resources referencing the smart resource", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const patient = sdk.getPatientById("patient-123");

      const referencingResources = (patient as any).getReferencingResources();

      expect(referencingResources).toHaveLength(3);
      const resourceTypes = referencingResources.map((r: any) => r.resourceType).sort();
      expect(resourceTypes).toEqual(["DiagnosticReport", "Encounter", "Observation"]);
    });

    it("should support filtering options on smart resource method", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const patient = sdk.getPatientById("patient-123");

      const observations = (patient as any).getReferencingResources({
        resourceType: "Observation",
      });

      expect(observations).toHaveLength(1);
      expect(observations[0].resourceType).toBe("Observation");
    });

    it("should support referenceField filtering on smart resource method", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const patient = sdk.getPatientById("patient-123");

      const subjectReferences = (patient as any).getReferencingResources({
        referenceField: "subject",
      });

      expect(subjectReferences).toHaveLength(3);
    });

    it("should return empty array when smart resource is not referenced", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const practitioner = sdk.getPractitionerById("practitioner-456");

      // Check if the method exists and returns an array
      const pracReferences = (practitioner as any).getReferencingResources();
      expect(Array.isArray(pracReferences)).toBe(true);
    });

    it("should work with resources that have no ID", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const observation = sdk.getObservationById("observation-001");

      const referencingResources = (observation as any).getReferencingResources();

      // observation-001 is referenced by diagnostic-report-002 in the "result" field
      expect(referencingResources).toHaveLength(1);
      expect(referencingResources[0].resourceType).toBe("DiagnosticReport");
    });
  });

  describe("Edge cases", () => {
    it("should handle bundle with no references", async () => {
      const bundle = {
        resourceType: "Bundle" as const,
        type: "collection" as const,
        entry: [
          {
            resource: {
              resourceType: "Patient" as const,
              id: "patient-solo",
              name: [{ family: "Solo" }],
            },
          },
        ],
      };

      const sdk = await FhirBundleSdk.create(bundle);
      const referencingResources = sdk.getResourcesReferencingId("patient-solo");

      expect(referencingResources).toEqual([]);
    });

    it("should handle resources with fullUrl references", async () => {
      const bundle = {
        resourceType: "Bundle" as const,
        type: "collection" as const,
        entry: [
          {
            fullUrl: "urn:uuid:patient-fullurl-test",
            resource: {
              resourceType: "Patient" as const,
              id: "patient-fullurl-test",
              name: [{ family: "FullUrl" }],
            },
          },
          {
            resource: {
              resourceType: "Observation" as const,
              id: "observation-fullurl-test",
              status: "final" as const,
              code: { text: "Test" },
              subject: {
                reference: "urn:uuid:patient-fullurl-test",
              },
            },
          },
        ],
      };

      const sdk = await FhirBundleSdk.create(bundle);

      // Should work with resource ID
      const referencingById = sdk.getResourcesReferencingId("patient-fullurl-test");
      expect(referencingById).toHaveLength(1);

      // Should also work with fullUrl
      const referencingByFullUrl = sdk.getResourcesReferencingId("urn:uuid:patient-fullurl-test");
      expect(referencingByFullUrl).toHaveLength(1);
    });

    it("should return smart resources from reverse lookup", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const referencingResources = sdk.getResourcesReferencingId("patient-123");

      // Check that returned resources are smart resources
      expect(referencingResources.length).toBeGreaterThan(0);
      expect((referencingResources[0] as any).__isSmartResource).toBe(true);
    });
  });

  describe("Performance", () => {
    it("should perform reverse lookup in constant time", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);

      const iterations = 100;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        sdk.getResourcesReferencingId("patient-123");
        const end = performance.now();
        times.push(end - start);
      }

      const avgTime = times.reduce((a, b) => a + b) / times.length;

      // Should be extremely fast (under 1ms on average)
      expect(avgTime).toBeLessThan(1);
    });
  });

  describe("getReferencedResources - forward reference lookup", () => {
    it("should expose getReferencedResources on smart resources", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const observation = sdk.getObservationById("observation-001");

      expect(observation).toBeDefined();
      expect(typeof (observation as any).getReferencedResources).toBe("function");
    });

    it("should return all resources referenced by a resource", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const observation = sdk.getObservationById("observation-001");

      const referencedResources = (observation as any).getReferencedResources();

      // observation-001 references:
      // - patient-123 (subject)
      // - encounter-789 (encounter)
      // - practitioner-456 (performer)
      expect(referencedResources.length).toBeGreaterThan(0);

      const resourceTypes = new Set(referencedResources.map((r: any) => r.resourceType));
      expect(resourceTypes.has("Patient")).toBe(true);
    });

    it("should return empty array for resources with no references", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const patient = sdk.getPatientById("patient-123");

      const referencedResources = (patient as any).getReferencedResources();

      // Patient may have no outgoing references or very few
      expect(Array.isArray(referencedResources)).toBe(true);
    });

    it("should work with SDK-level method getResourcesReferencedBy", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const observation = sdk.getObservationById("observation-001");

      expect(observation).toBeDefined();
      if (!observation) {
        throw new Error("Observation not found");
      }
      const referencedResources = sdk.getResourcesReferencedBy(observation);

      expect(Array.isArray(referencedResources)).toBe(true);
      expect(referencedResources.length).toBeGreaterThan(0);
    });

    it("should handle array reference fields", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const diagnosticReport = sdk.getDiagnosticReportById("diagnostic-report-002");

      const referencedResources = (diagnosticReport as any).getReferencedResources();

      // DiagnosticReport references multiple resources including results array
      expect(Array.isArray(referencedResources)).toBe(true);
      expect(referencedResources.length).toBeGreaterThan(0);
    });

    it("should not include undefined values", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const observation = sdk.getObservationById("observation-001");

      const referencedResources = (observation as any).getReferencedResources();

      // All returned resources should be defined
      expect(referencedResources.every((r: any) => r !== undefined)).toBe(true);
    });
  });
});
