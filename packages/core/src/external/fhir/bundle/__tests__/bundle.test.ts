/* eslint-disable @typescript-eslint/no-explicit-any */
import { BundleEntry } from "@medplum/fhirtypes";
import { makeCondition } from "../../../../fhir-to-cda/cda-templates/components/__tests__/make-condition";
import { makeAllergyIntollerance } from "../../__tests__/allergy-intolerance";
import { makeBundle } from "../../__tests__/bundle";
import { makePatient } from "../../__tests__/patient";
import {
  addEntriesToBundle,
  buildBundleEntry,
  buildSearchSetBundle,
  replaceBundleEntries,
} from "../bundle";

describe("Bundle", () => {
  describe("buildSearchSetBundle", () => {
    it("returns bundle with searchset type and entries", () => {
      const patient = makePatient();
      const allergy = makeAllergyIntollerance({ patient });
      const entries = [buildBundleEntry(patient), buildBundleEntry(allergy)];
      const bundle = buildSearchSetBundle(entries);

      expect(bundle).toEqual(
        expect.objectContaining({
          resourceType: "Bundle",
          type: "searchset",
          entry: entries,
        })
      );
    });

    it("sets total to the length of the entries when total is not provided", () => {
      const patient = makePatient();
      const allergy = makeAllergyIntollerance({ patient });
      const entries = [buildBundleEntry(patient), buildBundleEntry(allergy)];
      const bundle = buildSearchSetBundle(entries);

      expect(bundle).toEqual(expect.objectContaining({ total: entries.length }));
    });

    it("sets total to the provided total when total is provided", () => {
      const patient = makePatient();
      const allergy = makeAllergyIntollerance({ patient });
      const entries = [buildBundleEntry(patient), buildBundleEntry(allergy)];
      const bundle = buildSearchSetBundle(entries, 10);

      expect(bundle).toEqual(expect.objectContaining({ total: 10 }));
    });
  });

  describe("replaceBundleEntries", () => {
    it("returns new bundle with same data and updated entries when gets subset of entries", () => {
      const patient = makePatient();
      const allergy = makeAllergyIntollerance({ patient });
      const bundle = makeBundle({ entries: [patient, allergy] });
      const entries = [buildBundleEntry(patient)];

      const result = replaceBundleEntries(bundle, entries);

      expect(result).toEqual({
        ...bundle,
        entry: entries,
      });
    });

    it("returns new bundle with same data and updated entries when gets new entries", () => {
      const patient = makePatient();
      const allergy = makeAllergyIntollerance({ patient });
      const bundle = makeBundle({ entries: [patient, allergy] });
      const condition = makeCondition();
      const entries = [
        buildBundleEntry(patient),
        buildBundleEntry(allergy),
        buildBundleEntry(condition),
      ];

      const result = replaceBundleEntries(bundle, entries);

      expect(result).toEqual({
        ...bundle,
        entry: entries,
      });
    });

    it("returns new bundle without total when original one does not have total", () => {
      const patient = makePatient();
      const allergy = makeAllergyIntollerance({ patient });
      const bundle = makeBundle({ entries: [patient, allergy] });
      const entries = [buildBundleEntry(patient), buildBundleEntry(allergy)];

      const result = replaceBundleEntries(bundle, entries);

      expect(result).toEqual({
        ...bundle,
        entry: entries,
      });
      expect(result.total).toBeUndefined();
    });

    it("returns new bundle with total when original one has total", () => {
      const patient = makePatient();
      const allergy = makeAllergyIntollerance({ patient });
      const bundle = makeBundle({ entries: [patient, allergy], type: "searchset" });
      const entries = [buildBundleEntry(patient), buildBundleEntry(allergy)];

      const result = replaceBundleEntries(bundle, entries);

      expect(result).toEqual({
        ...bundle,
        entry: entries,
      });
      expect(result.total).toBe(2);
    });
  });

  describe("addEntriesToBundle", () => {
    it("keeps original entries when adding empty entries", () => {
      const patient = makePatient();
      const allergy = makeAllergyIntollerance({ patient });
      const bundle = makeBundle({ entries: [patient, allergy] });
      const entries: BundleEntry[] = [];

      const result = addEntriesToBundle(bundle, entries);

      expect(result).toEqual(bundle);
    });

    it("returns new bundle with same data and new entries when gets new entries", () => {
      const patient = makePatient();
      const allergy = makeAllergyIntollerance({ patient });
      const bundle = makeBundle({ entries: [patient, allergy] });
      const condition = makeCondition();
      const entries = [buildBundleEntry(condition)];

      const result = addEntriesToBundle(bundle, entries);

      expect(result).toEqual({
        ...bundle,
        entry: [...(bundle.entry ?? []), ...entries],
      });
    });

    it("returns new bundle with new entries when original one has no entries", () => {
      const bundle = makeBundle();
      const condition = makeCondition();
      const entries = [buildBundleEntry(condition)];

      const result = addEntriesToBundle(bundle, entries);

      expect(result).toEqual({ ...bundle, entry: entries });
    });

    it("returns new bundle with new entries when original one has entries array empty", () => {
      const bundle = makeBundle({ entries: [] });
      const condition = makeCondition();
      const entries = [buildBundleEntry(condition)];

      const result = addEntriesToBundle(bundle, entries);

      expect(result).toEqual({ ...bundle, entry: entries });
    });
  });
});
