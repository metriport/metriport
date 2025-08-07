import { FhirBundleSdk } from "../index";
import {
  validCompleteBundle,
  emptyBundle,
  patientsOnlyBundle,
  mixedResourceTypesBundle,
  CONSTANT_TIME_EXPECTED_THRESHOLD_MS,
} from "./fixtures/fhir-bundles";
import { Patient } from "@medplum/fhirtypes";

describe("Phase 2 Verification - Type-Specific Resource Getters", () => {
  describe("Type-Specific Resource Getters - FR-4.1 to FR-4.7", () => {
    let sdk: FhirBundleSdk;

    beforeEach(async () => {
      sdk = await FhirBundleSdk.create(validCompleteBundle);
    });

    describe("FR-4.1: getPatients(): Patient[] returns all Patient resources", () => {
      it("should return all patients from validCompleteBundle", async () => {
        const patients = sdk.getPatients();

        expect(Array.isArray(patients)).toBe(true);
        expect(patients).toHaveLength(1);
        expect(patients[0]?.resourceType).toBe("Patient");
        expect(patients[0]?.id).toBe("patient-123");
        expect(patients[0]?.name?.[0]?.family).toBe("Doe");
        expect(patients[0]?.name?.[0]?.given?.[0]).toBe("Jane");
      });

      it("should return multiple patients from mixedResourceTypesBundle", async () => {
        const mixedSdk = await FhirBundleSdk.create(mixedResourceTypesBundle);
        const patients = mixedSdk.getPatients();

        expect(patients).toHaveLength(2);
        expect(patients[0]?.id).toBe("patient-mix-1");
        expect(patients[1]?.id).toBe("patient-mix-2");
        expect(patients.every(p => p.resourceType === "Patient")).toBe(true);
      });
    });

    describe("FR-4.2: getObservations(): Observation[] returns all Observation resources", () => {
      it("should return all observations", async () => {
        const observations = sdk.getObservations();

        expect(Array.isArray(observations)).toBe(true);
        expect(observations).toHaveLength(1);
        expect(observations[0]?.resourceType).toBe("Observation");
        expect(observations[0]?.id).toBe("observation-001");
        expect(observations[0]?.code?.text).toBe("Glucose");
        expect(observations[0]?.status).toBe("final");
      });

      it("should return multiple observations from mixedResourceTypesBundle", async () => {
        const mixedSdk = await FhirBundleSdk.create(mixedResourceTypesBundle);
        const observations = mixedSdk.getObservations();

        expect(observations).toHaveLength(2);
        expect(observations[0]?.id).toBe("observation-mix-1");
        expect(observations[1]?.id).toBe("observation-mix-2");
        expect(observations.every(o => o.resourceType === "Observation")).toBe(true);
      });
    });

    describe("FR-4.3: getEncounters(): Encounter[] returns all Encounter resources", () => {
      it("should return all encounters", async () => {
        const encounters = sdk.getEncounters();

        expect(Array.isArray(encounters)).toBe(true);
        expect(encounters).toHaveLength(1);
        expect(encounters[0]?.resourceType).toBe("Encounter");
        expect(encounters[0]?.id).toBe("encounter-789");
        expect(encounters[0]?.status).toBe("finished");
        expect(encounters[0]?.class?.code).toBe("AMB");
      });
    });

    describe("FR-4.4: getPractitioners(): Practitioner[] returns all Practitioner resources", () => {
      it("should return all practitioners", async () => {
        const practitioners = sdk.getPractitioners();

        expect(Array.isArray(practitioners)).toBe(true);
        expect(practitioners).toHaveLength(1);
        expect(practitioners[0]?.resourceType).toBe("Practitioner");
        expect(practitioners[0]?.id).toBe("practitioner-456");
        expect(practitioners[0]?.name?.[0]?.family).toBe("Smith");
        expect(practitioners[0]?.name?.[0]?.given?.[0]).toBe("John");
      });
    });

    describe("FR-4.5: getDiagnosticReports(): DiagnosticReport[] returns all DiagnosticReport resources", () => {
      it("should return all diagnostic reports", async () => {
        const reports = sdk.getDiagnosticReports();

        expect(Array.isArray(reports)).toBe(true);
        expect(reports).toHaveLength(1);
        expect(reports[0]?.resourceType).toBe("DiagnosticReport");
        expect(reports[0]?.id).toBe("diagnostic-report-002");
        expect(reports[0]?.status).toBe("final");
        expect(reports[0]?.code?.text).toBe("Lab Results");
      });
    });

    describe("FR-4.6: All type-specific getters return empty array if no resources of that type exist", () => {
      it("should return empty arrays for empty bundle", async () => {
        const emptySdk = await FhirBundleSdk.create(emptyBundle);

        expect(emptySdk.getPatients()).toEqual([]);
        expect(emptySdk.getObservations()).toEqual([]);
        expect(emptySdk.getEncounters()).toEqual([]);
        expect(emptySdk.getPractitioners()).toEqual([]);
        expect(emptySdk.getDiagnosticReports()).toEqual([]);
      });

      it("should return empty arrays for missing resource types in patientsOnlyBundle", async () => {
        const patientsSdk = await FhirBundleSdk.create(patientsOnlyBundle);

        expect(patientsSdk.getPatients()).toHaveLength(3); // Has patients
        expect(patientsSdk.getObservations()).toEqual([]);
        expect(patientsSdk.getEncounters()).toEqual([]);
        expect(patientsSdk.getPractitioners()).toEqual([]);
        expect(patientsSdk.getDiagnosticReports()).toEqual([]);
      });
    });

    describe("FR-4.7: All methods use @medplum/fhirtypes for return type definitions", () => {
      it("should return properly typed resources with TypeScript compilation", async () => {
        const patients = sdk.getPatients();
        const observations = sdk.getObservations();
        const encounters = sdk.getEncounters();
        const practitioners = sdk.getPractitioners();
        const reports = sdk.getDiagnosticReports();

        // TypeScript compilation will enforce correct typing
        // These properties should be available without type errors
        expect(patients[0]?.name).toBeDefined();
        expect(patients[0]?.birthDate).toBeDefined();

        expect(observations[0]?.status).toBeDefined();
        expect(observations[0]?.code).toBeDefined();

        expect(encounters[0]?.status).toBeDefined();
        expect(encounters[0]?.class).toBeDefined();

        expect(practitioners[0]?.name).toBeDefined();
        expect(practitioners[0]?.qualification).toBeDefined();

        expect(reports[0]?.status).toBeDefined();
        expect(reports[0]?.code).toBeDefined();
      });
    });
  });

  describe("Performance Requirements", () => {
    describe("FR-9.2: Type-specific getters complete in O(n) time where n is number of resources of that type", () => {
      it("should perform type-specific queries efficiently", async () => {
        const mixedSdk = await FhirBundleSdk.create(mixedResourceTypesBundle);

        const start = performance.now();
        const patients = mixedSdk.getPatients();
        const end = performance.now();

        expect(patients).toHaveLength(2);
        // Should be fast for small bundles (O(n) where n=2)
        expect(end - start).toBeLessThan(CONSTANT_TIME_EXPECTED_THRESHOLD_MS);
      });

      it("should handle multiple type queries efficiently", async () => {
        const mixedSdk = await FhirBundleSdk.create(mixedResourceTypesBundle);

        const start = performance.now();

        // Perform multiple type-specific queries
        const patients = mixedSdk.getPatients();
        const observations = mixedSdk.getObservations();
        const practitioners = mixedSdk.getPractitioners();
        const encounters = mixedSdk.getEncounters();
        const reports = mixedSdk.getDiagnosticReports();

        const end = performance.now();

        expect(patients).toHaveLength(2);
        expect(observations).toHaveLength(2);
        expect(practitioners).toHaveLength(1);
        expect(encounters).toHaveLength(1);
        expect(reports).toHaveLength(0);

        // Multiple O(n) queries should still be fast
        expect(end - start).toBeLessThan(50);
      });
    });
  });

  describe("Memory Management - FR-10.1 and FR-10.2", () => {
    it("should return references to cached objects, not copies", async () => {
      const testSdk = await FhirBundleSdk.create(validCompleteBundle);
      const patients1 = testSdk.getPatients();
      const patients2 = testSdk.getPatients();

      // Should return the same array reference
      expect(patients1).toBe(patients2);

      // Should return the same patient object
      expect(patients1[0]).toBe(patients2[0]);
    });

    it("should maintain object identity across different access methods", async () => {
      const testSdk = await FhirBundleSdk.create(validCompleteBundle);
      const patient1 = testSdk.getResourceById<Patient>("patient-123");
      const patients = testSdk.getPatients();
      const patient2 = patients[0];

      // Should be the same object instance
      expect(patient1).toBe(patient2);
    });
  });

  describe("Edge Cases and Robustness", () => {
    it("should handle bundle with undefined entries gracefully", async () => {
      const bundleWithUndefinedEntries = {
        resourceType: "Bundle" as const,
        type: "collection" as const,
        total: 2,
        entry: [
          {
            fullUrl: "urn:uuid:patient-valid",
            resource: {
              resourceType: "Patient" as const,
              id: "patient-valid",
              name: [{ family: "Valid", given: ["Patient"] }],
            },
          },
          {
            fullUrl: "urn:uuid:entry-without-resource",
            // No resource field
          },
        ],
      };

      const testSdk = await FhirBundleSdk.create(bundleWithUndefinedEntries);
      const patients = testSdk.getPatients();

      expect(patients).toHaveLength(1);
      expect(patients[0]?.id).toBe("patient-valid");
    });

    it("should handle resources with same type but different structures", async () => {
      const bundleWithVariedPatients = {
        resourceType: "Bundle" as const,
        type: "collection" as const,
        total: 2,
        entry: [
          {
            fullUrl: "urn:uuid:patient-full",
            resource: {
              resourceType: "Patient" as const,
              id: "patient-full",
              name: [{ family: "Full", given: ["Patient"] }],
              gender: "female" as const,
              birthDate: "1990-01-01",
            },
          },
          {
            fullUrl: "urn:uuid:patient-minimal",
            resource: {
              resourceType: "Patient" as const,
              id: "patient-minimal",
              // Minimal patient with only required fields
            },
          },
        ],
      };

      const testSdk = await FhirBundleSdk.create(bundleWithVariedPatients);
      const patients = testSdk.getPatients();

      expect(patients).toHaveLength(2);
      expect(patients[0]?.id).toBe("patient-full");
      expect(patients[1]?.id).toBe("patient-minimal");
      expect(patients[0]?.name).toBeDefined();
      expect(patients[1]?.name).toBeUndefined();
    });
  });
});
