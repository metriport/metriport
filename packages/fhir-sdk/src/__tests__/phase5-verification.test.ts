/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { FhirBundleSdk } from "../index";
import {
  validCompleteBundle,
  bundleWithBrokenReferences,
  CONSTANT_TIME_EXPECTED_THRESHOLD_MS,
} from "./fixtures/fhir-bundles";

describe("Phase 5 Verification - Smart Reference Resolution", () => {
  describe("FR-5.1: Resources returned by SDK have additional getter methods for each Reference field", () => {
    it("should add reference methods to Observation resources", () => {
      const sdk = new FhirBundleSdk(validCompleteBundle);
      const observations = sdk.getObservations();

      expect(observations.length).toBeGreaterThan(0);
      const observation = observations[0]!;

      expect(typeof observation.getSubject).toBe("function");
      expect(typeof observation.getEncounter).toBe("function");
      expect(typeof observation.getPerformers).toBe("function");
    });

    it("should add reference methods to Encounter resources", () => {
      const sdk = new FhirBundleSdk(validCompleteBundle);
      const encounters = sdk.getEncounters();

      expect(encounters.length).toBeGreaterThan(0);
      const encounter = encounters[0]!;

      expect(typeof encounter.getSubject).toBe("function");
      expect(typeof encounter.getParticipants).toBe("function");
    });
  });

  describe("FR-5.2: For Observation.subject reference, SDK adds getSubject() method", () => {
    it("should resolve subject reference to Patient", () => {
      const sdk = new FhirBundleSdk(validCompleteBundle);
      const observations = sdk.getObservations();

      expect(observations.length).toBeGreaterThan(0);
      const observation = observations[0]!;
      const subject = observation.getSubject();

      expect(subject).toBeDefined();
      expect(subject?.resourceType).toBe("Patient");
      expect(subject?.id).toBe("patient-123");
    });
  });

  describe("FR-5.3: For Observation.encounter reference, SDK adds getEncounter() method", () => {
    it("should resolve encounter reference to Encounter", () => {
      const sdk = new FhirBundleSdk(validCompleteBundle);
      const observations = sdk.getObservations();

      expect(observations.length).toBeGreaterThan(0);
      const observation = observations[0]!;
      const encounter = observation.getEncounter();

      expect(encounter).toBeDefined();
      expect(encounter?.resourceType).toBe("Encounter");
      expect(encounter?.id).toBe("encounter-789");
    });
  });

  describe("FR-5.4: For Observation.performer reference array, SDK adds getPerformers() method", () => {
    it("should resolve performer references to array of resources", () => {
      const sdk = new FhirBundleSdk(validCompleteBundle);
      const observations = sdk.getObservations();

      expect(observations.length).toBeGreaterThan(0);
      const observation = observations[0]!;
      const performers = observation.getPerformers();

      expect(Array.isArray(performers)).toBe(true);
      expect(performers.length).toBe(1);
      expect(performers[0]?.resourceType).toBe("Practitioner");
      expect(performers[0]?.id).toBe("practitioner-456");
    });
  });

  describe("FR-5.5: Reference resolution methods handle both resource.id and fullUrl matching", () => {
    it("should resolve references by resource.id", () => {
      const sdk = new FhirBundleSdk(validCompleteBundle);
      const observations = sdk.getObservations();

      expect(observations.length).toBeGreaterThan(0);
      const observation = observations[0]!;
      const subject = observation.getSubject();

      expect(subject?.id).toBe("patient-123");
    });
  });

  describe("FR-5.6: Reference resolution methods return undefined for unresolvable references", () => {
    it("should return undefined for broken references", () => {
      const sdk = new FhirBundleSdk(bundleWithBrokenReferences);
      const observations = sdk.getObservations();

      if (observations.length > 0) {
        const observation = observations[0]!;
        expect(observation.getSubject()).toBeUndefined();
        expect(observation.getEncounter()).toBeUndefined();
      }
    });

    it("should return empty array for missing array references", () => {
      const sdk = new FhirBundleSdk(bundleWithBrokenReferences);
      const observations = sdk.getObservations();

      if (observations.length > 0) {
        const observation = observations[0]!;
        const performers = observation.getPerformers();
        expect(Array.isArray(performers)).toBe(true);
        expect(performers).toHaveLength(0);
      }
    });
  });

  describe("FR-5.7: Reference resolution operates in O(1) time complexity per reference", () => {
    it("should resolve references in O(1) time", () => {
      const sdk = new FhirBundleSdk(validCompleteBundle);
      const observations = sdk.getObservations();

      expect(observations.length).toBeGreaterThan(0);
      const observation = observations[0]!;

      const start = performance.now();
      observation.getSubject();
      const end = performance.now();

      expect(end - start).toBeLessThan(CONSTANT_TIME_EXPECTED_THRESHOLD_MS);
    });
  });

  describe("FR-5.8: Original reference fields remain unchanged", () => {
    it("should preserve original reference fields", () => {
      const sdk = new FhirBundleSdk(validCompleteBundle);
      const observations = sdk.getObservations();

      expect(observations.length).toBeGreaterThan(0);
      const observation = observations[0]!;

      expect(observation.subject).toEqual({ reference: "Patient/patient-123" });
      expect(observation.encounter).toEqual({ reference: "Encounter/encounter-789" });
      expect(observation.performer).toEqual([{ reference: "Practitioner/practitioner-456" }]);
    });

    it("should not include getter methods in JSON serialization", () => {
      const sdk = new FhirBundleSdk(validCompleteBundle);
      const observations = sdk.getObservations();

      expect(observations.length).toBeGreaterThan(0);
      const observation = observations[0]!;

      const serialized = JSON.stringify(observation);
      expect(serialized).not.toContain("getSubject");
      expect(serialized).not.toContain("getEncounter");
      expect(serialized).not.toContain("getPerformer");
    });
  });

  describe("Reference Chaining", () => {
    it("should support chaining through resolved references", () => {
      const sdk = new FhirBundleSdk(validCompleteBundle);
      const observations = sdk.getObservations();

      expect(observations.length).toBeGreaterThan(0);
      const observation = observations[0]!;

      // Chain: Observation → Encounter → Patient
      const patientViaChain = observation.getEncounter()?.getSubject();

      expect(patientViaChain).toBeDefined();
      expect(patientViaChain?.resourceType).toBe("Patient");
      expect(patientViaChain?.id).toBe("patient-123");
    });

    it("should handle broken chains gracefully", () => {
      const sdk = new FhirBundleSdk(bundleWithBrokenReferences);
      const observations = sdk.getObservations();

      if (observations.length > 0) {
        const observation = observations[0]!;
        const brokenChain = observation.getEncounter()?.getSubject();
        expect(brokenChain).toBeUndefined();
      }
    });
  });

  describe("Smart Resource Identity and Caching", () => {
    it("should maintain object identity for cached resources", () => {
      const sdk = new FhirBundleSdk(validCompleteBundle);
      const observation1 = sdk.getObservations()[0];
      const observation2 = sdk.getObservations()[0];

      expect(observation1).toBe(observation2);
    });

    it("should maintain consistency across different access methods", () => {
      const sdk = new FhirBundleSdk(validCompleteBundle);
      const observationFromList = sdk.getObservations()[0];
      const observationById = sdk.getResourceById("observation-001");

      expect(observationFromList).toBe(observationById);
    });

    it("should cache resolved references", () => {
      const sdk = new FhirBundleSdk(validCompleteBundle);
      const observations = sdk.getObservations();

      expect(observations.length).toBeGreaterThan(0);
      const observation = observations[0]!;

      const subject1 = observation.getSubject();
      const subject2 = observation.getSubject();

      expect(subject1).toBe(subject2);
    });
  });

  describe("Array Reference Chaining", () => {
    it("should support chaining through array elements", () => {
      const sdk = new FhirBundleSdk(validCompleteBundle);
      const reports = sdk.getDiagnosticReports();

      if (reports.length > 0) {
        const report = reports[0]!;
        const results = report.getResults();

        expect(Array.isArray(results)).toBe(true);
        if (results.length > 0) {
          const firstResult = results[0]!;
          expect(typeof firstResult.getSubject).toBe("function");

          const patient = firstResult.getSubject();
          expect(patient?.resourceType).toBe("Patient");
        }
      }
    });
  });

  describe("Smart Resource Marker", () => {
    it("should mark resources as smart resources", () => {
      const sdk = new FhirBundleSdk(validCompleteBundle);
      const observations = sdk.getObservations();

      expect(observations.length).toBeGreaterThan(0);
      const observation = observations[0]!;

      // Check the smart resource marker
      expect(observation.__isSmartResource).toBe(true);
    });
  });
});
