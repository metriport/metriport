import { cloneDeep } from "lodash";
import { makeAllergyIntollerance } from "../../../external/fhir/__tests__/allergy-intolerance";
import { makeBundle } from "../../../external/fhir/__tests__/bundle";
import { makeEncounter } from "../../../fhir-to-cda/cda-templates/components/__tests__/make-encounter";
import { makeImmunization } from "../../../fhir-to-cda/cda-templates/components/__tests__/make-immunization";
import { filterConsolidated } from "../consolidated-filter";

describe("consolidated-filter", () => {
  describe("filterConsolidated", () => {
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
});
