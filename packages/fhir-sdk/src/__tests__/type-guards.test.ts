import { Bundle, Resource } from "@medplum/fhirtypes";
import { FhirBundleSdk } from "../fhir-bundle-sdk";
import { isDiagnosticReport, isObservation, isPatient } from "../type-guards";

describe("Type Guards", () => {
  describe("Basic type narrowing with mixed resource arrays", () => {
    test("filters mixed Resource array to specific type with proper inference", () => {
      const resources: Resource[] = [
        { resourceType: "Patient", id: "patient-1" },
        { resourceType: "Observation", id: "obs-1", status: "final", code: { text: "test" } },
        { resourceType: "Patient", id: "patient-2" },
        {
          resourceType: "DiagnosticReport",
          id: "report-1",
          status: "final",
          code: { text: "test" },
        },
        { resourceType: "Observation", id: "obs-2", status: "final", code: { text: "test" } },
      ];

      const patients = resources.filter(isPatient);
      const observations = resources.filter(isObservation);
      const reports = resources.filter(isDiagnosticReport);

      // Type assertions validate TypeScript properly inferred the types
      expect(patients).toHaveLength(2);
      expect(observations).toHaveLength(2);
      expect(reports).toHaveLength(1);

      // TypeScript knows these are Patients, so we can access Patient-specific fields
      patients.forEach(patient => {
        expect(patient.resourceType).toBe("Patient");
        // This wouldn't compile if TypeScript didn't narrow the type
        void patient.name; // Patient-specific field accessible due to type narrowing
      });

      // TypeScript knows these are Observations
      observations.forEach(obs => {
        expect(obs.resourceType).toBe("Observation");
        expect(obs.status).toBe("final"); // Observation-specific field accessible
      });
    });
  });

  describe("Type guards with Smart resources", () => {
    test("filters Smart resources with proper type inference", async () => {
      const bundle: Bundle = {
        resourceType: "Bundle",
        type: "collection",
        entry: [
          { resource: { resourceType: "Patient", id: "patient-1" } },
          {
            resource: {
              resourceType: "Observation",
              id: "obs-1",
              status: "final",
              code: { text: "test" },
              subject: { reference: "Patient/patient-1" },
            },
          },
          { resource: { resourceType: "Patient", id: "patient-2" } },
          {
            resource: {
              resourceType: "Encounter",
              id: "enc-1",
              status: "finished",
              class: { code: "test" },
            },
          },
          {
            resource: {
              resourceType: "Observation",
              id: "obs-2",
              status: "final",
              code: { text: "test" },
            },
          },
        ],
      };

      const sdk = await FhirBundleSdk.create(bundle);

      // Test filtering observations directly - this is the main use case
      const allObservations = sdk.getObservations();
      expect(allObservations).toHaveLength(2);

      allObservations.forEach(obs => {
        expect(obs.resourceType).toBe("Observation");
        expect(obs.__isSmartResource).toBe(true);
        // Type guard confirms it's an Observation, so we can access observation-specific fields
        if (isObservation(obs)) {
          const subject = obs.getSubject();
          void subject;
        }
      });

      // Test filtering patients
      const allPatients = sdk.getPatients();
      expect(allPatients).toHaveLength(2);

      allPatients.forEach(patient => {
        expect(patient.resourceType).toBe("Patient");
        expect(patient.__isSmartResource).toBe(true);
      });
    });

    test("type guards work in conditional blocks with Smart resources", async () => {
      const bundle: Bundle = {
        resourceType: "Bundle",
        type: "collection",
        entry: [
          {
            resource: {
              resourceType: "Patient",
              id: "patient-1",
              name: [{ given: ["Jane"], family: "Doe" }],
            },
          },
          {
            resource: {
              resourceType: "Observation",
              id: "obs-1",
              status: "final",
              code: { text: "test" },
              valueQuantity: { value: 120, unit: "mmHg" },
            },
          },
        ],
      };

      const sdk = await FhirBundleSdk.create(bundle);
      const resource1 = sdk.getResourceById("patient-1");
      const resource2 = sdk.getResourceById("obs-1");

      // Type guard in conditional - TypeScript should narrow the type
      if (resource1 && isPatient(resource1)) {
        expect(resource1.resourceType).toBe("Patient");
        const name = resource1.name?.[0]?.given?.[0];
        expect(name).toBe("Jane");
      }

      if (resource2 && isObservation(resource2)) {
        expect(resource2.resourceType).toBe("Observation");
        const value = resource2.valueQuantity?.value;
        expect(value).toBe(120);
      }
    });
  });

  describe("Edge cases", () => {
    test("handles undefined gracefully", () => {
      expect(isPatient(undefined)).toBe(false);
      expect(isObservation(undefined)).toBe(false);
      expect(isDiagnosticReport(undefined)).toBe(false);
    });

    test("filters out undefined values from array", () => {
      const resources: (Resource | undefined)[] = [
        { resourceType: "Patient", id: "1" },
        undefined,
        { resourceType: "Observation", id: "2", status: "final", code: { text: "test" } },
        undefined,
      ];

      const patients = resources.filter(isPatient);
      const observations = resources.filter(isObservation);

      expect(patients).toHaveLength(1);
      expect(observations).toHaveLength(1);
    });

    test("returns empty array when no matches found", () => {
      const resources: Resource[] = [
        { resourceType: "Patient", id: "1" },
        { resourceType: "Patient", id: "2" },
      ];

      const observations = resources.filter(isObservation);
      expect(observations).toHaveLength(0);
    });
  });
});
