import { FhirBundleSdk } from "../index";
import {
  validCompleteBundle,
  bundleWithBrokenReferences,
  bundleWithFullUrlReferences,
  emptyBundle,
  patientsOnlyBundle,
  invalidBundleWrongType,
  invalidBundleWrongBundleType,
  mixedResourceTypesBundle,
  CONSTANT_TIME_EXPECTED_THRESHOLD_MS,
} from "./fixtures/fhir-bundles";
import { Patient } from "@medplum/fhirtypes";

describe("FhirBundleSdk", () => {
  describe("Bundle Loading and Initialization", () => {
    describe("FR-1.1: SDK constructor accepts a FHIR Bundle object", () => {
      it("should accept a valid FHIR bundle", async () => {
        await expect(FhirBundleSdk.create(validCompleteBundle)).resolves.not.toThrow();
      });
    });

    describe("FR-1.2: SDK constructor throws error if bundle.resourceType !== 'Bundle'", () => {
      it("should throw error for invalid resourceType", async () => {
        await expect(FhirBundleSdk.create(invalidBundleWrongType)).rejects.toThrow();
      });
    });

    describe("FR-1.3: SDK constructor throws error if bundle.type !== 'collection'", () => {
      it("should throw error for invalid bundle type", async () => {
        await expect(FhirBundleSdk.create(invalidBundleWrongBundleType)).rejects.toThrow(
          "Invalid bundle: type must be 'collection'"
        );
      });
    });

    describe("FR-1.4: SDK constructor creates internal indexes for O(1) resource lookup", () => {
      it("should create internal indexes during construction", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const start = performance.now();
        const patient = sdk.getResourceById<Patient>("patient-123");
        const end = performance.now();

        expect(patient).toBeDefined();
        expect(patient?.resourceType).toBe("Patient");
        expect(end - start).toBeLessThan(1);
      });
    });
  });

  describe("Reference Validation", () => {
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
    });
  });

  describe("Resource Retrieval by ID", () => {
    describe("FR-3.1: getResourceById<T>(id: string): T | undefined returns resource matching the ID", () => {
      it("should return resource by ID", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const patient = sdk.getResourceById<Patient>("patient-123");

        expect(patient).toBeDefined();
        expect(patient?.id).toBe("patient-123");
        expect(patient?.resourceType).toBe("Patient");
      });
    });

    describe("FR-3.2: Method searches both resource.id and entry.fullUrl for matches", () => {
      it("should find resource by resource.id", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const patient = sdk.getResourceById<Patient>("patient-123");

        expect(patient?.id).toBe("patient-123");
      });

      it("should find resource by fullUrl", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const patient = sdk.getResourceById<Patient>("urn:uuid:patient-123");

        expect(patient?.id).toBe("patient-123");
      });
    });

    describe("FR-3.3: Method supports type parameter for proper TypeScript return typing", () => {
      it("should return properly typed resource", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const patient = sdk.getResourceById<Patient>("patient-123");

        // TypeScript should infer this as Patient | undefined
        expect(patient?.name).toBeDefined();
        expect(patient?.birthDate).toBeDefined();
      });
    });

    describe("FR-3.4: Method returns undefined if resource not found", () => {
      it("should return undefined for nonexistent resource", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const result = sdk.getResourceById<Patient>("nonexistent-id");

        expect(result).toBeUndefined();
      });
    });

    describe("FR-3.5: Lookup operates in O(1) time complexity", () => {
      it("should perform lookup in O(1) time", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);

        const start = performance.now();
        sdk.getResourceById<Patient>("patient-123");
        const end = performance.now();

        // O(1) lookup should be very fast
        expect(end - start).toBeLessThan(1);
      });
    });
  });

  describe("Type-Specific Resource Getters", () => {
    describe("FR-4.1: getPatients(): Patient[] returns all Patient resources", () => {
      it("should return all patients", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const patients = sdk.getPatients();

        expect(Array.isArray(patients)).toBe(true);
        expect(patients).toHaveLength(1);
        expect(patients[0]?.resourceType).toBe("Patient");
      });
    });

    describe("FR-4.2: getObservations(): Observation[] returns all Observation resources", () => {
      it("should return all observations", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const observations = sdk.getObservations();

        expect(Array.isArray(observations)).toBe(true);
        expect(observations).toHaveLength(1);
        expect(observations[0]?.resourceType).toBe("Observation");
      });
    });

    describe("FR-4.3: getEncounters(): Encounter[] returns all Encounter resources", () => {
      it("should return all encounters", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const encounters = sdk.getEncounters();

        expect(Array.isArray(encounters)).toBe(true);
        expect(encounters).toHaveLength(1);
        expect(encounters[0]?.resourceType).toBe("Encounter");
      });
    });

    describe("FR-4.4: getPractitioners(): Practitioner[] returns all Practitioner resources", () => {
      it("should return all practitioners", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const practitioners = sdk.getPractitioners();

        expect(Array.isArray(practitioners)).toBe(true);
        expect(practitioners).toHaveLength(1);
        expect(practitioners[0]?.resourceType).toBe("Practitioner");
      });
    });

    describe("FR-4.5: getDiagnosticReports(): DiagnosticReport[] returns all DiagnosticReport resources", () => {
      it("should return all diagnostic reports", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const reports = sdk.getDiagnosticReports();

        expect(Array.isArray(reports)).toBe(true);
        expect(reports).toHaveLength(1);
        expect(reports[0]?.resourceType).toBe("DiagnosticReport");
      });
    });

    describe("FR-4.6: All type-specific getters return empty array if no resources of that type exist", () => {
      it("should return empty array when no resources exist", async () => {
        const sdk = await FhirBundleSdk.create(emptyBundle);

        expect(sdk.getPatients()).toEqual([]);
        expect(sdk.getObservations()).toEqual([]);
        expect(sdk.getEncounters()).toEqual([]);
        expect(sdk.getPractitioners()).toEqual([]);
        expect(sdk.getDiagnosticReports()).toEqual([]);
      });

      it("should return empty array for missing resource types", async () => {
        const sdk = await FhirBundleSdk.create(patientsOnlyBundle);

        expect(sdk.getPatients()).toHaveLength(3);
        expect(sdk.getObservations()).toEqual([]);
        expect(sdk.getEncounters()).toEqual([]);
        expect(sdk.getPractitioners()).toEqual([]);
        expect(sdk.getDiagnosticReports()).toEqual([]);
      });
    });

    describe("FR-4.7: All methods use @medplum/fhirtypes for return type definitions", () => {
      it("should return properly typed resources", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);

        const patients = sdk.getPatients();
        const observations = sdk.getObservations();
        const encounters = sdk.getEncounters();
        const practitioners = sdk.getPractitioners();
        const reports = sdk.getDiagnosticReports();

        // TypeScript compilation will enforce correct typing
        expect(patients[0]?.name).toBeDefined();
        expect(observations[0]?.status).toBeDefined();
        expect(encounters[0]?.status).toBeDefined();
        expect(practitioners[0]?.name).toBeDefined();
        expect(reports[0]?.status).toBeDefined();
      });
    });
  });

  describe("Smart Reference Resolution", () => {
    describe("FR-5.1: Resources returned by SDK have additional getter methods for each Reference field", () => {
      it("should add getter methods for reference fields", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const observations = sdk.getObservations();
        const observation = observations[0];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(typeof (observation as any)?.getSubject).toBe("function");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(typeof (observation as any)?.getEncounter).toBe("function");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(typeof (observation as any)?.getPerformers).toBe("function");
      });
    });

    describe("FR-5.2: For Observation.subject reference, SDK adds getSubject() method", () => {
      it("should resolve subject reference to Patient", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const observations = sdk.getObservations();
        const observation = observations[0];

        const subject = observation?.getSubject();
        expect(subject).toBeDefined();
        expect(subject?.resourceType).toBe("Patient");
        expect(subject?.id).toBe("patient-123");
      });
    });

    describe("FR-5.3: For Observation.encounter reference, SDK adds getEncounter() method", () => {
      it("should resolve encounter reference to Encounter", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const observations = sdk.getObservations();
        const observation = observations[0];

        const encounter = observation?.getEncounter();
        expect(encounter).toBeDefined();
        expect(encounter?.resourceType).toBe("Encounter");
        expect(encounter?.id).toBe("encounter-789");
      });
    });

    describe("FR-5.4: For Observation.performer reference array, SDK adds getPerformer() method", () => {
      it("should resolve performer references to array of resources", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const observations = sdk.getObservations();
        const observation = observations[0];

        const performers = observation?.getPerformers();
        expect(Array.isArray(performers)).toBe(true);
        expect(performers).toHaveLength(1);
        expect(performers?.[0]?.resourceType).toBe("Practitioner");
        expect(performers?.[0]?.id).toBe("practitioner-456");
      });
    });

    describe("FR-5.5: Reference resolution methods handle both resource.id and fullUrl matching", () => {
      it("should resolve references by resource.id", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const observations = sdk.getObservations();
        const subject = observations[0]?.getSubject();

        expect(subject?.id).toBe("patient-123");
      });

      it("should resolve references by fullUrl", async () => {
        const sdk = await FhirBundleSdk.create(bundleWithFullUrlReferences);
        const observations = sdk.getObservations();
        const subject = observations[0]?.getSubject();

        expect(subject?.id).toBe("patient-fullurl");
      });
    });

    describe("FR-5.6: Reference resolution methods return undefined for unresolvable references", () => {
      it("should return undefined for broken references", async () => {
        const sdk = await FhirBundleSdk.create(bundleWithBrokenReferences);
        const observations = sdk.getObservations();
        const observation = observations[0];

        expect(observation?.getSubject()).toBeUndefined();
        expect(observation?.getEncounter()).toBeUndefined();
        expect(observation?.getPerformers()).toEqual([]);
      });
    });

    describe("FR-5.7: Reference resolution operates in O(1) time complexity per reference", () => {
      it("should resolve references in O(1) time", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const observations = sdk.getObservations();
        const observation = observations[0];

        const start = performance.now();
        observation?.getSubject();
        const end = performance.now();

        // O(1) resolution should be very fast
        expect(end - start).toBeLessThan(CONSTANT_TIME_EXPECTED_THRESHOLD_MS);
      });
    });

    describe("FR-5.8: Original reference fields remain unchanged", () => {
      it("should preserve original reference fields", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const observations = sdk.getObservations();
        const observation = observations[0];

        expect(observation?.subject?.reference).toBe("Patient/patient-123");
        expect(observation?.encounter?.reference).toBe("Encounter/encounter-789");
        expect(observation?.performer?.[0]?.reference).toBe("Practitioner/practitioner-456");
      });
    });
  });

  describe("Bundle Export Functionality", () => {
    describe("FR-6.1: exportSubset(resourceIds: string[]): Bundle creates new bundle with specified resources", () => {
      it("should export subset of resources by ID", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const subset = sdk.exportSubset(["patient-123", "observation-001"]);

        expect(subset.resourceType).toBe("Bundle");
        expect(subset.type).toBe("collection");
        expect(subset.entry).toHaveLength(2);
        expect(subset.total).toBe(2);
      });
    });

    describe("FR-6.2: exportByType(resourceType: string): Bundle creates new bundle with all resources of specified type", () => {
      it("should export all resources of specified type", async () => {
        const sdk = await FhirBundleSdk.create(mixedResourceTypesBundle);
        const patientBundle = sdk.exportByType("Patient");

        expect(patientBundle.resourceType).toBe("Bundle");
        expect(patientBundle.type).toBe("collection");
        expect(patientBundle.entry).toHaveLength(2);
        expect(patientBundle.total).toBe(2);
        expect(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          patientBundle.entry?.every((entry: any) => entry.resource?.resourceType === "Patient")
        ).toBe(true);
      });
    });

    describe("FR-6.3: exportByTypes(resourceTypes: string[]): Bundle creates new bundle with all resources of specified types", () => {
      it("should export all resources of specified types", async () => {
        const sdk = await FhirBundleSdk.create(mixedResourceTypesBundle);
        const bundle = sdk.exportByTypes(["Patient", "Observation"]);

        expect(bundle.resourceType).toBe("Bundle");
        expect(bundle.type).toBe("collection");
        expect(bundle.entry).toHaveLength(4); // 2 patients + 2 observations
        expect(bundle.total).toBe(4);
      });
    });

    describe("FR-6.4: Exported bundles maintain original bundle metadata but update total count", () => {
      it("should maintain metadata and update total", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const subset = sdk.exportSubset(["patient-123"]);

        expect(subset.resourceType).toBe("Bundle");
        expect(subset.type).toBe("collection");
        expect(subset.total).toBe(1); // Updated count
        expect(subset.id).toBeDefined(); // Metadata preserved
      });
    });

    describe("FR-6.5: Exported bundles include only resources that exist in the original bundle", () => {
      it("should ignore nonexistent resource IDs", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const subset = sdk.exportSubset(["patient-123", "nonexistent-id"]);

        expect(subset.entry).toHaveLength(1);
        expect(subset.total).toBe(1);
      });
    });

    describe("FR-6.6: Exported bundles preserve original entry.fullUrl values", () => {
      it("should preserve fullUrl values", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const subset = sdk.exportSubset(["patient-123"]);

        expect(subset.entry?.[0]?.fullUrl).toBe("urn:uuid:patient-123");
      });
    });
  });

  describe("Error Handling", () => {
    describe("FR-7.1: All methods handle malformed resource references gracefully", () => {
      it("should handle malformed references without throwing", async () => {
        const sdk = await FhirBundleSdk.create(bundleWithBrokenReferences);

        expect(() => {
          const observations = sdk.getObservations();
          observations[0]?.getSubject();
        }).not.toThrow();
      });
    });

    describe("FR-7.2: SDK throws descriptive errors for invalid bundle structure during initialization", () => {
      it("should throw descriptive error for invalid bundle", async () => {
        await expect(FhirBundleSdk.create(invalidBundleWrongType)).rejects.toThrow(
          "Invalid bundle: resourceType must be 'Bundle'"
        );
      });
    });

    describe("FR-7.3: Reference resolution methods never throw errors, only return undefined for invalid references", () => {
      it("should return undefined instead of throwing for invalid references", async () => {
        const sdk = await FhirBundleSdk.create(bundleWithBrokenReferences);
        const observations = sdk.getObservations();

        expect(() => observations[0]?.getSubject()).not.toThrow();
        expect(observations[0]?.getSubject()).toBeUndefined();
      });
    });
  });

  describe("Performance Requirements", () => {
    describe("FR-9.1: Resource lookup by ID completes in O(1) time", () => {
      it("should perform ID lookup in O(1) time", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);

        const start = performance.now();
        sdk.getResourceById("patient-123");
        const end = performance.now();

        expect(end - start).toBeLessThan(1);
      });
    });

    describe("FR-9.2: Type-specific getters complete in O(n) time where n is number of resources of that type", () => {
      it("should perform type-specific queries efficiently", async () => {
        const sdk = await FhirBundleSdk.create(mixedResourceTypesBundle);

        const start = performance.now();
        const patients = sdk.getPatients();
        const end = performance.now();

        expect(patients).toHaveLength(2);
        expect(end - start).toBeLessThan(5); // Should be fast for small bundles
      });
    });

    describe("FR-9.4: Reference resolution per reference completes in O(1) time", () => {
      it("should resolve references in O(1) time", async () => {
        const sdk = await FhirBundleSdk.create(validCompleteBundle);
        const observations = sdk.getObservations();

        const start = performance.now();
        observations[0]?.getSubject();
        const end = performance.now();

        expect(end - start).toBeLessThan(1);
      });
    });
  });
});
