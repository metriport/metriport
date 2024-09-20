/* eslint-disable @typescript-eslint/no-explicit-any */
import { Bundle, Medication, Reference, Resource } from "@medplum/fhirtypes";
import { cloneDeep } from "lodash";
import { toReference } from "../../../external/fhir/shared/references";
import { makeAllergyIntollerance } from "../../../external/fhir/__tests__/allergy-intolerance";
import { makeBundle } from "../../../external/fhir/__tests__/bundle";
import { makeMedicationRequest } from "../../../fhir-deduplication/__tests__/examples/medication-related";
import { makeComposition } from "../../../fhir-to-cda/cda-templates/components/__tests__/make-composition";
import { makeEncounter } from "../../../fhir-to-cda/cda-templates/components/__tests__/make-encounter";
import { makeImmunization } from "../../../fhir-to-cda/cda-templates/components/__tests__/make-immunization";
import { makeMedication } from "../../../fhir-to-cda/cda-templates/components/__tests__/make-medication";
import { addMissingReferences, filterConsolidated } from "../consolidated-filter";

let addMissingReferences_mock: typeof addMissingReferences;

beforeAll(() => {
  jest.restoreAllMocks();
  addMissingReferences_mock = jest.fn(
    (
      filteredBundle: Bundle<Resource>,
      originalBundle: Bundle<Resource>,
      addMissingReferencesFn,
      iteration
    ) => {
      return addMissingReferences(
        filteredBundle,
        originalBundle,
        addMissingReferencesFn,
        iteration
      );
    }
  );
});
beforeEach(() => {
  jest.clearAllMocks();
});
afterAll(() => {
  jest.restoreAllMocks();
});

describe("consolidated-filter", () => {
  describe("filterConsolidated - filters", () => {
    it(`returns original bundle when no filters`, async () => {
      const bundle = makeBundle({
        entries: [makeAllergyIntollerance(), makeAllergyIntollerance()],
      });
      const res = await filterConsolidated(cloneDeep(bundle), {});
      expect(res).toBeTruthy();
      expect(res).toEqual(bundle);
    });

    it(`filters by resource type with single resource filter`, async () => {
      const expected = makeAllergyIntollerance();
      const bundle = makeBundle({
        entries: [makeImmunization(), expected, makeEncounter()],
      });
      const res = await filterConsolidated(cloneDeep(bundle), {
        resources: ["AllergyIntolerance"],
      });
      expect(res).toBeTruthy();
      expect(res.entry).toBeTruthy();
      expect(res.entry?.length).toEqual(1);
      const res_res1 = res.entry?.[0]?.resource;
      expect(res_res1).toBeTruthy();
      expect(res_res1).toEqual(expected);
    });

    it(`filters by resource type with multiple resource filter`, async () => {
      const expected1 = makeAllergyIntollerance();
      const expected2 = makeEncounter();
      const bundle = makeBundle({
        entries: [makeImmunization(), expected1, expected2],
      });
      const res = await filterConsolidated(cloneDeep(bundle), {
        resources: ["AllergyIntolerance", "Encounter"],
      });
      expect(res).toBeTruthy();
      expect(res.entry).toBeTruthy();
      expect(res.entry?.length).toEqual(2);
      const resources = (res.entry ?? []).map(e => e.resource);
      expect(resources).toBeTruthy();
      expect(resources.length).toEqual(2);
      expect(resources).toEqual(expect.arrayContaining([expected1, expected2]));
    });

    it(`filters by date in addition to resource type`, async () => {
      const allergy1 = makeAllergyIntollerance();
      allergy1.onsetDateTime = "2021-01-01";
      const allergy2 = makeAllergyIntollerance();
      allergy2.onsetDateTime = "2022-01-01";
      const bundle = makeBundle({
        entries: [makeImmunization(), allergy1, allergy2, makeEncounter()],
      });
      const res = await filterConsolidated(cloneDeep(bundle), {
        resources: ["AllergyIntolerance"],
        dateFrom: "2021-06-01",
      });
      expect(res).toBeTruthy();
      expect(res.entry).toBeTruthy();
      expect(res.entry?.length).toEqual(1);
      const resources = (res.entry ?? []).map(e => e.resource);
      expect(resources).toBeTruthy();
      expect(resources.length).toEqual(1);
      expect(resources).toEqual(expect.arrayContaining([allergy2]));
    });
  });

  describe("filterConsolidated - missing refs", () => {
    it(`includes resource not included on filter`, async () => {
      const medication1 = makeMedication();
      const medicationRef1 = toReference(medication1);
      const medicationRequest1 = makeMedicationRequest(
        medicationRef1 ? { medicationReference: medicationRef1 } : {}
      );
      const medication2 = makeMedication();
      const medicationRef2 = toReference(medication2);
      const medicationRequest2 = makeMedicationRequest(
        medicationRef2 ? { medicationReference: medicationRef2 } : {}
      );
      const entries = [medication1, medication2, medicationRequest1, medicationRequest2];
      const bundle = makeBundle({ entries });
      const res = await filterConsolidated(cloneDeep(bundle), {
        resources: ["MedicationRequest"],
      });
      expect(res).toBeTruthy();
      const returnedResources = (res.entry ?? []).map(e => e.resource);
      expect(returnedResources).toBeTruthy();
      expect(returnedResources.length).toBe(entries.length);
      expect(returnedResources).toEqual(expect.arrayContaining(entries));
    });

    it(`includes multiple levels`, async () => {
      const medication = makeMedication();
      const medicationRef = toReference(medication);
      const medicationRequest = makeMedicationRequest(
        medicationRef ? { medicationReference: medicationRef } : {}
      );
      const medicationRequestRef = toReference(medicationRequest);
      const composition = makeComposition(undefined, {
        section: [{ entry: medicationRequestRef ? [medicationRequestRef] : [] }],
      });
      const entries = [medication, medicationRequest, composition];
      const bundle = makeBundle({ entries });
      const res = await filterConsolidated(cloneDeep(bundle), {
        resources: ["Composition"],
      });
      expect(res).toBeTruthy();
      const returnedResources = (res.entry ?? []).map(e => e.resource);
      expect(returnedResources).toBeTruthy();
      expect(returnedResources.length).toBe(entries.length);
      expect(returnedResources).toEqual(expect.arrayContaining(entries));
    });

    it(`adds missing refs up to 5 levels`, async () => {
      const med = makeMedication(); // this should not make it to the final bundle
      const medRef = toReference(med);
      const medRequest1 = makeMedicationRequest(medRef ? { medicationReference: medRef } : {});
      const medRequestRef1 = toReference(medRequest1) as any as Reference<Medication>;
      const medRequest2 = makeMedicationRequest(
        medRequestRef1 ? { medicationReference: medRequestRef1 } : {}
      );
      const medRequestRef2 = toReference(medRequest2) as any as Reference<Medication>;
      const medRequest3 = makeMedicationRequest(
        medRequestRef2 ? { medicationReference: medRequestRef2 } : {}
      );
      const medRequestRef3 = toReference(medRequest3) as any as Reference<Medication>;
      const medRequest4 = makeMedicationRequest(
        medRequestRef3 ? { medicationReference: medRequestRef3 } : {}
      );
      const medRequestRef4 = toReference(medRequest4) as any as Reference<Medication>;
      const medRequest5 = makeMedicationRequest(
        medRequestRef4 ? { medicationReference: medRequestRef4 } : {}
      );
      const medRequestRef5 = toReference(medRequest5);
      const composition = makeComposition(undefined, {
        section: [{ entry: medRequestRef5 ? [medRequestRef5] : [] }],
      });
      const expectedEntries = [
        medRequest1,
        medRequest2,
        medRequest3,
        medRequest4,
        medRequest5,
        composition,
      ];
      const entries = [med, ...expectedEntries];
      const bundle = makeBundle({ entries });
      const res = await filterConsolidated(
        cloneDeep(bundle),
        { resources: ["Composition"] },
        addMissingReferences_mock
      );
      expect(res).toBeTruthy();
      const returnedResources = (res.entry ?? []).map(e => e.resource);
      expect(returnedResources).toBeTruthy();
      expect(returnedResources.length).toBe(expectedEntries.length);
      expect(returnedResources).toEqual(expect.arrayContaining(expectedEntries));
      expect(addMissingReferences_mock).toHaveBeenCalledTimes(5);
    });
  });
});
