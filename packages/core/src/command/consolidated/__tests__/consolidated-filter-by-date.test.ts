import { makeAllergyIntollerance } from "../../../external/fhir/__tests__/allergy-intolerance";
import { makeBundle } from "../../../external/fhir/__tests__/bundle";
import { makePatient } from "../../../external/fhir/__tests__/patient";
import { filterBundleByDate } from "../consolidated-filter-by-date";

describe("filterBundleByDate", () => {
  describe("AllergyIntolerance", () => {
    it(`returns original bundle when no date filters`, async () => {
      const bundle = makeBundle({ entries: [makeAllergyIntollerance()] });
      const res = filterBundleByDate(bundle);
      expect(res).toBeTruthy();
      expect(res).toEqual(bundle);
    });

    it(`filters out by onsetDateTime when filter is from`, async () => {
      const r1 = makeAllergyIntollerance();
      r1.onsetDateTime = "2021-01-01";
      const r2 = makeAllergyIntollerance();
      r2.onsetDateTime = "2022-02-02";
      const bundle = makeBundle({ entries: [r1, r2] });
      const res = filterBundleByDate(bundle, "2022-01-01");
      expect(res).toBeTruthy();
      expect(res.entry).toBeTruthy();
      expect(res.entry?.length).toEqual(1);
      const res_res1 = res.entry?.[0]?.resource;
      expect(res_res1).toBeTruthy();
      expect(res_res1).toEqual(r2);
    });

    it(`doesnt filter out by onsetDateTime when filter is to`, async () => {
      const r1 = makeAllergyIntollerance();
      r1.onsetDateTime = "2021-01-01";
      const r2 = makeAllergyIntollerance();
      r2.onsetDateTime = "2022-02-02";
      const bundle = makeBundle({ entries: [r1, r2] });
      const res = filterBundleByDate(bundle, undefined, "2022-01-01");
      expect(res).toBeTruthy();
      expect(res.entry).toBeTruthy();
      expect(res.entry?.length).toEqual(2);
      const res_res1 = res.entry?.map(e => e.resource);
      expect(res_res1).toEqual(expect.arrayContaining([r1, r2]));
    });

    it(`filters out by onsetDateTime when filter is from/to and items inside the range`, async () => {
      const r1 = makeAllergyIntollerance();
      r1.onsetDateTime = "2021-01-01";
      const r2 = makeAllergyIntollerance();
      r2.onsetDateTime = "2022-02-02";
      const bundle = makeBundle({ entries: [r1, r2] });
      const res = filterBundleByDate(bundle, "2022-01-01", "2022-03-01");
      expect(res).toBeTruthy();
      expect(res.entry).toBeTruthy();
      expect(res.entry?.length).toEqual(1);
      const res_res1 = res.entry?.[0]?.resource;
      expect(res_res1).toBeTruthy();
      expect(res_res1).toEqual(r2);
    });

    it(`filters out by onsetAge`, async () => {
      const r1 = makeAllergyIntollerance();
      r1.onsetAge = { value: 10, unit: "a" };
      const r2 = makeAllergyIntollerance();
      r2.onsetAge = { value: 20, unit: "a" };
      const birthDate = "2000-01-01";
      const patient = makePatient({ birthDate });
      const bundle = makeBundle({ entries: [r1, r2, patient] });
      const res = filterBundleByDate(bundle, "2018-01-01");
      expect(res).toBeTruthy();
      expect(res.entry).toBeTruthy();
      expect(res.entry?.length).toEqual(2);
      const resResources = res.entry?.map(e => e.resource);
      expect(resResources).toEqual(expect.arrayContaining([patient, r2]));
    });

    it(`doesnt filter out onsetAge by end of range`, async () => {
      const resource = makeAllergyIntollerance();
      resource.onsetAge = { value: 20, unit: "a" };
      const birthDate = "2000-01-01";
      const patient = makePatient({ birthDate });
      const bundle = makeBundle({ entries: [resource, patient] });
      const res = filterBundleByDate(bundle, "2018-01-01", "2019-01-01");
      expect(res).toBeTruthy();
      expect(res.entry).toBeTruthy();
      expect(res.entry?.length).toEqual(2);
      const resResources = res.entry?.map(e => e.resource);
      expect(resResources).toEqual(expect.arrayContaining([patient, resource]));
    });
  });
});
