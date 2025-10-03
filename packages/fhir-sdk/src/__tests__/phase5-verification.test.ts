/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { inspect } from "util";
import { FhirBundleSdk } from "../index";
import {
  validCompleteBundle,
  bundleWithBrokenReferences,
  CONSTANT_TIME_EXPECTED_THRESHOLD_MS,
} from "./fixtures/fhir-bundles";

describe("Phase 5 Verification - Smart Reference Resolution", () => {
  describe("FR-5.1: Resources returned by SDK have additional getter methods for each Reference field", () => {
    it("should add reference methods to Observation resources", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const observations = sdk.getObservations();

      expect(observations.length).toBeGreaterThan(0);
      const observation = observations[0]!;

      expect(typeof observation.getSubject).toBe("function");
      expect(typeof observation.getEncounter).toBe("function");
      expect(typeof observation.getPerformers).toBe("function");
    });

    it("should add reference methods to Encounter resources", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const encounters = sdk.getEncounters();

      expect(encounters.length).toBeGreaterThan(0);
      const encounter = encounters[0]!;

      expect(typeof encounter.getSubject).toBe("function");
      expect(typeof encounter.getParticipants).toBe("function");
    });
  });

  describe("FR-5.2: For Observation.subject reference, SDK adds getSubject() method", () => {
    it("should resolve subject reference to Patient", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
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
    it("should resolve encounter reference to Encounter", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
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
    it("should resolve performer references to array of resources", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
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
    it("should resolve references by resource.id", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const observations = sdk.getObservations();

      expect(observations.length).toBeGreaterThan(0);
      const observation = observations[0]!;
      const subject = observation.getSubject();

      expect(subject?.id).toBe("patient-123");
    });
  });

  describe("FR-5.6: Reference resolution methods return undefined for unresolvable references", () => {
    it("should return undefined for broken references", async () => {
      const sdk = await FhirBundleSdk.create(bundleWithBrokenReferences);
      const observations = sdk.getObservations();

      if (observations.length > 0) {
        const observation = observations[0]!;
        expect(observation.getSubject()).toBeUndefined();
        expect(observation.getEncounter()).toBeUndefined();
      }
    });

    it("should return empty array for missing array references", async () => {
      const sdk = await FhirBundleSdk.create(bundleWithBrokenReferences);
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
    it("should resolve references in O(1) time", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
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
    it("should preserve original reference fields", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const observations = sdk.getObservations();

      expect(observations.length).toBeGreaterThan(0);
      const observation = observations[0]!;

      expect(observation.subject).toEqual({ reference: "Patient/patient-123" });
      expect(observation.encounter).toEqual({ reference: "Encounter/encounter-789" });
      expect(observation.performer).toEqual([{ reference: "Practitioner/practitioner-456" }]);
    });

    it("should not include getter methods in JSON serialization", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
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
    it("should support chaining through resolved references", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const observations = sdk.getObservations();

      expect(observations.length).toBeGreaterThan(0);
      const observation = observations[0]!;

      // Chain: Observation → Encounter → Patient
      const patientViaChain = observation.getEncounter()?.getSubject();

      expect(patientViaChain).toBeDefined();
      expect(patientViaChain?.resourceType).toBe("Patient");
      expect(patientViaChain?.id).toBe("patient-123");
    });

    it("should handle broken chains gracefully", async () => {
      const sdk = await FhirBundleSdk.create(bundleWithBrokenReferences);
      const observations = sdk.getObservations();

      if (observations.length > 0) {
        const observation = observations[0]!;
        const brokenChain = observation.getEncounter()?.getSubject();
        expect(brokenChain).toBeUndefined();
      }
    });
  });

  describe("Smart Resource Identity and Caching", () => {
    it("should maintain object identity for cached resources", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const observation1 = sdk.getObservations()[0];
      const observation2 = sdk.getObservations()[0];

      expect(observation1).toBe(observation2);
    });

    it("should maintain consistency across different access methods", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const observationFromList = sdk.getObservations()[0];
      const observationById = sdk.getResourceById("observation-001");

      expect(observationFromList).toBe(observationById);
    });

    it("should cache resolved references", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const observations = sdk.getObservations();

      expect(observations.length).toBeGreaterThan(0);
      const observation = observations[0]!;

      const subject1 = observation.getSubject();
      const subject2 = observation.getSubject();

      expect(subject1).toBe(subject2);
    });
  });

  describe("Array Reference Chaining", () => {
    it("should support chaining through array elements", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
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
    it("should mark resources as smart resources", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const observations = sdk.getObservations();

      expect(observations.length).toBeGreaterThan(0);
      const observation = observations[0]!;

      // Check the smart resource marker
      expect(observation.__isSmartResource).toBe(true);
    });
  });

  describe("Smart Resource toString() method", () => {
    it("should render resources without proxy limitations", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const observations = sdk.getObservations();

      expect(observations.length).toBeGreaterThan(0);
      const observation = observations[0]!;

      const stringified = observation.toString();

      expect(typeof stringified).toBe("string");
      expect(stringified).toContain('"resourceType"');
      expect(stringified).toContain('"id"');
      expect(stringified).not.toContain("__isSmartResource");
      expect(stringified).not.toContain("getSubject");
    });

    it("should render nested objects deeply", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const observation = sdk.getObservationById("observation-001");

      expect(observation).toBeDefined();
      const stringified = observation!.toString();

      const parsed = JSON.parse(stringified);
      expect(parsed.subject).toBeDefined();
      expect(parsed.subject.reference).toBeDefined();
      expect(parsed.encounter).toBeDefined();
      expect(parsed.encounter.reference).toBeDefined();
    });

    it("should support custom spacing", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const observation = sdk.getObservationById("observation-001");

      expect(observation).toBeDefined();
      const compactString = observation!.toString(0);
      const spacedString = observation!.toString(4);

      expect(compactString.length).toBeLessThan(spacedString.length);
      expect(compactString).not.toContain("\n");
      expect(spacedString).toContain("\n");
    });

    it("should render complex nested structures", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const patients = sdk.getPatients();

      expect(patients.length).toBeGreaterThan(0);
      const patient = patients[0]!;
      const stringified = patient.toString();

      const parsed = JSON.parse(stringified);
      expect(parsed.resourceType).toBe("Patient");
      expect(parsed.id).toBe("patient-123");
      if (parsed.name && parsed.name.length > 0) {
        expect(parsed.name[0]).toBeDefined();
      }
    });

    it("should automatically format for console.log and REPL via util.inspect", async () => {
      const sdk = await FhirBundleSdk.create(validCompleteBundle);
      const observation = sdk.getObservationById("observation-001");

      expect(observation).toBeDefined();

      // util.inspect is what console.log and REPL use under the hood
      const inspected = inspect(observation);

      // Should be formatted as readable object output, not [Object] or [Proxy]
      expect(inspected).toContain("resourceType:");
      expect(inspected).toContain("Observation");
      expect(inspected).toContain("id:");
      expect(inspected).not.toContain("[Proxy]");
      expect(inspected).not.toContain("getSubject");
      expect(inspected).not.toContain("__isSmartResource");
    });
  });

  describe("Nested Reference Path Resolution", () => {
    describe("Encounter.diagnosis.condition", () => {
      it("should resolve diagnosis.condition nested array reference", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const encounters = sdk.getEncounters();

        expect(encounters.length).toBeGreaterThan(0);
        const encounter = encounters[0]!;

        expect(typeof encounter.getDiagnosisCondition).toBe("function");
        const conditions = encounter.getDiagnosisCondition();

        expect(Array.isArray(conditions)).toBe(true);
        expect(conditions.length).toBe(1);
        expect(conditions[0]?.resourceType).toBe("Condition");
        expect(conditions[0]?.id).toBe("condition-222");
      });

      it("should preserve original diagnosis array field", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const encounters = sdk.getEncounters();

        expect(encounters.length).toBeGreaterThan(0);
        const encounter = encounters[0]!;

        expect(encounter.diagnosis).toBeDefined();
        expect(Array.isArray(encounter.diagnosis)).toBe(true);
        expect(encounter.diagnosis?.[0]?.condition).toEqual({
          reference: "Condition/condition-222",
        });
      });
    });

    describe("Encounter.participant.individual", () => {
      it("should resolve participant.individual nested array reference", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const encounters = sdk.getEncounters();

        expect(encounters.length).toBeGreaterThan(0);
        const encounter = encounters[0]!;

        expect(typeof encounter.getParticipants).toBe("function");
        const participants = encounter.getParticipants();

        expect(Array.isArray(participants)).toBe(true);
        expect(participants.length).toBe(1);
        expect(participants[0]?.resourceType).toBe("Practitioner");
        expect(participants[0]?.id).toBe("practitioner-456");
      });
    });

    describe("Encounter.location.location", () => {
      it("should resolve location.location nested array reference", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const encounters = sdk.getEncounters();

        expect(encounters.length).toBeGreaterThan(0);
        const encounter = encounters[0]!;

        expect(typeof encounter.getLocation).toBe("function");
        const locations = encounter.getLocation();

        expect(Array.isArray(locations)).toBe(true);
        expect(locations.length).toBe(1);
        expect(locations[0]?.resourceType).toBe("Location");
        expect(locations[0]?.id).toBe("location-111");
      });
    });

    describe("Encounter.hospitalization.origin", () => {
      it("should resolve hospitalization.origin nested single reference", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const encounters = sdk.getEncounters();

        expect(encounters.length).toBeGreaterThan(0);
        const encounter = encounters[0]!;

        expect(typeof encounter.getHospitalizationOrigin).toBe("function");
        const origin = encounter.getHospitalizationOrigin();

        expect(origin).toBeDefined();
        expect(origin?.resourceType).toBe("Location");
        expect(origin?.id).toBe("location-111");
      });
    });

    describe("Encounter.hospitalization.destination", () => {
      it("should resolve hospitalization.destination nested single reference", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const encounters = sdk.getEncounters();

        expect(encounters.length).toBeGreaterThan(0);
        const encounter = encounters[0]!;

        expect(typeof encounter.getHospitalizationDestination).toBe("function");
        const destination = encounter.getHospitalizationDestination();

        expect(destination).toBeDefined();
        expect(destination?.resourceType).toBe("Location");
        expect(destination?.id).toBe("location-111");
      });
    });

    describe("Patient.contact.organization", () => {
      it("should resolve contact.organization nested array reference", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const patients = sdk.getPatients();

        expect(patients.length).toBeGreaterThan(0);
        const patient = patients[0]!;

        expect(typeof patient.getContactOrganization).toBe("function");
        const organizations = patient.getContactOrganization();

        expect(Array.isArray(organizations)).toBe(true);
        expect(organizations.length).toBe(1);
        expect(organizations[0]?.resourceType).toBe("Organization");
        expect(organizations[0]?.id).toBe("org-123");
      });
    });

    describe("Practitioner.qualification.issuer", () => {
      it("should resolve qualification.issuer nested array reference", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const practitioners = sdk.getPractitioners();

        expect(practitioners.length).toBeGreaterThan(0);
        const practitioner = practitioners[0]!;

        expect(typeof practitioner.getQualificationIssuer).toBe("function");
        const issuers = practitioner.getQualificationIssuer();

        expect(Array.isArray(issuers)).toBe(true);
        expect(issuers.length).toBe(1);
        expect(issuers[0]?.resourceType).toBe("Organization");
        expect(issuers[0]?.id).toBe("org-123");
      });
    });

    describe("Missing nested references", () => {
      it("should return empty array when nested array reference field is missing", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const diagnosticReports = sdk.getDiagnosticReports();

        expect(diagnosticReports.length).toBeGreaterThan(0);
        const report = diagnosticReports[0]!;

        // DiagnosticReport has no media.link in our fixture
        expect(typeof report.getMediaLink).toBe("function");
        const mediaLinks = report.getMediaLink();

        expect(Array.isArray(mediaLinks)).toBe(true);
        expect(mediaLinks.length).toBe(0);
      });

      it("should return undefined when nested single reference field is missing", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const patients = sdk.getPatients();

        expect(patients.length).toBeGreaterThan(0);
        const patient = patients[0]!;

        // Patient has no link.other in our fixture
        expect(typeof patient.getLinkOther).toBe("function");
        const linkOthers = patient.getLinkOther();

        // getLinkOther returns an array since link is an array field
        expect(Array.isArray(linkOthers)).toBe(true);
        expect(linkOthers.length).toBe(0);
      });
    });
  });
});
