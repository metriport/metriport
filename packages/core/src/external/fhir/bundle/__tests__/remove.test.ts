/* eslint-disable @typescript-eslint/no-explicit-any */
import { Bundle } from "@medplum/fhirtypes";
import { makeAllergyIntollerance } from "../../__tests__/allergy-intolerance";
import { makeBundle } from "../../__tests__/bundle";
import { makePatient } from "../../__tests__/patient";
import { removeContainedResources, removeResources } from "../remove";

describe("Bundle Remove", () => {
  describe("removeResources", () => {
    it("returns the same bundle when no resources should be removed", () => {
      const patient = makePatient();
      const allergy = makeAllergyIntollerance({ patient });
      const bundle = makeBundle({ entries: [patient, allergy] });

      const result = removeResources({
        bundle,
        shouldRemove: () => false,
      });

      expect(result).toEqual(bundle);
      expect(result.entry).toHaveLength(2);
      expect(result.total).toBeUndefined();
    });

    it("returns empty bundle when all resources should be removed", () => {
      const patient = makePatient();
      const allergy = makeAllergyIntollerance({ patient });
      const bundle = makeBundle({ entries: [patient, allergy] });

      const result = removeResources({
        bundle,
        shouldRemove: () => true,
      });

      expect(result.entry).toHaveLength(0);
      expect(result.total).toBeUndefined();
      expect(result.resourceType).toBe("Bundle");
      expect(result.type).toBe("transaction");
    });

    it("keeps total and type when original bundle has total", () => {
      const patient = makePatient();
      const allergy = makeAllergyIntollerance({ patient });
      const bundle = makeBundle({ entries: [patient, allergy], type: "searchset" });

      const result = removeResources({
        bundle,
        shouldRemove: () => false,
      });

      expect(result.total).toBe(2);
      expect(result.resourceType).toBe("Bundle");
      expect(result.type).toBe("searchset");
    });

    it("removes only resources that match the shouldRemove condition", () => {
      const patient1 = makePatient({ id: "patient-1" });
      const patient2 = makePatient({ id: "patient-2" });
      const allergy = makeAllergyIntollerance({ patient: patient1 });
      const bundle = makeBundle({ entries: [patient1, patient2, allergy] });

      const result = removeResources({
        bundle,
        shouldRemove: resource =>
          resource.resourceType === "Patient" && resource.id === "patient-1",
      });

      expect(result.entry).toHaveLength(2);
      expect(result.entry?.[0]?.resource?.resourceType).toBe("Patient");
      expect(result.entry?.[0]?.resource?.id).toBe("patient-2");
      expect(result.entry?.[1]?.resource?.resourceType).toBe("AllergyIntolerance");
    });

    it("returns the same bundle when bundle has no entries", () => {
      const bundle = makeBundle({ entries: [] });

      const result = removeResources({
        bundle,
        shouldRemove: () => true,
      });

      expect(result).toEqual(bundle);
      expect(result.entry).toHaveLength(0);
      expect(result.total).toBeUndefined();
    });

    it("returns the same bundle when bundle entry is undefined", () => {
      const bundle: Bundle = {
        resourceType: "Bundle",
        type: "transaction",
      };

      const result = removeResources({
        bundle,
        shouldRemove: () => true,
      });

      expect(result).toEqual(bundle);
      expect(result.entry).toBeUndefined();
    });

    it("keep resources with undefined resource field", () => {
      const bundle = makeBundle();
      bundle.entry = [{ resource: undefined as any }];

      const result = removeResources({
        bundle,
        shouldRemove: () => true,
      });

      expect(result.entry).toHaveLength(1);
      expect(result.entry).toBeDefined();
      expect(result.entry).toHaveLength(1);
    });

    it("preserves bundle metadata when removing resources", () => {
      const patient = makePatient();
      const bundle = makeBundle({
        entries: [patient],
        type: "collection",
      });

      const result = removeResources({
        bundle,
        shouldRemove: () => true,
      });

      expect(result.resourceType).toBe("Bundle");
      expect(result.type).toBe("collection");
      expect(result.entry).toHaveLength(0);
      expect(result.total).toBeUndefined();
    });
  });

  describe("removeContainedResources", () => {
    it("returns the same bundle when no contained resources should be removed", () => {
      const patient = makePatient();
      const allergy = makeAllergyIntollerance({ patient });
      const bundle = makeBundle({ entries: [allergy] });

      const result = removeContainedResources({
        bundle,
        shouldRemove: () => false,
      });

      expect(result).toEqual(bundle);
      expect(result.entry).toHaveLength(1);
      expect(result.total).toBeUndefined();
    });

    it("removes contained resources that match the shouldRemove condition", () => {
      const patient1 = makePatient({ id: "patient-1" });
      const patient2 = makePatient({ id: "patient-2" });
      const allergy = makeAllergyIntollerance({ patient: patient1 });
      if (allergy.contained) allergy.contained.push(patient1, patient2);
      else allergy.contained = [patient1, patient2];
      const bundle = makeBundle({ entries: [allergy] });

      const result = removeContainedResources({
        bundle,
        shouldRemove: resource =>
          resource.resourceType === "Patient" && resource.id === "patient-1",
      });

      expect(result.entry).toHaveLength(1);
      expect(result.total).toBeUndefined();
      const resultAllergy = result.entry?.[0]?.resource as any;
      expect(resultAllergy.contained).toHaveLength(1);
      expect(resultAllergy.contained[0].id).toBe("patient-2");
    });

    it("removes all contained resources when all should be removed", () => {
      const patient1 = makePatient({ id: "patient-1" });
      const patient2 = makePatient({ id: "patient-2" });
      const allergy = makeAllergyIntollerance({ patient: patient1 });
      if (allergy.contained) allergy.contained.push(patient1, patient2);
      else allergy.contained = [patient1, patient2];
      const bundle = makeBundle({ entries: [allergy] });

      const result = removeContainedResources({
        bundle,
        shouldRemove: () => true,
      });

      expect(result.entry).toHaveLength(1);
      expect(result.total).toBeUndefined();
      const resultAllergy = result.entry?.[0]?.resource as any;
      expect(resultAllergy.contained).toHaveLength(0);
    });

    it("handles resources without contained array", () => {
      const patient = makePatient();
      const bundle = makeBundle({ entries: [patient] });

      const result = removeContainedResources({
        bundle,
        shouldRemove: () => true,
      });

      expect(result).toEqual(bundle);
      expect(result.entry).toHaveLength(1);
      expect(result.total).toBeUndefined();
    });

    it("handles resources with empty contained array", () => {
      const allergy = makeAllergyIntollerance();
      allergy.contained = [];
      const bundle = makeBundle({ entries: [allergy] });

      const result = removeContainedResources({
        bundle,
        shouldRemove: () => true,
      });

      expect(result.entry).toHaveLength(1);
      expect(result.total).toBeUndefined();
      const resultAllergy = result.entry?.[0]?.resource as any;
      expect(resultAllergy.contained).toHaveLength(0);
    });

    it("returns the same bundle when bundle has no entries", () => {
      const bundle = makeBundle({ entries: [] });

      const result = removeContainedResources({
        bundle,
        shouldRemove: () => true,
      });

      expect(result).toEqual(bundle);
      expect(result.entry).toHaveLength(0);
      expect(result.total).toBeUndefined();
    });

    it("returns the same bundle when bundle entry is undefined", () => {
      const bundle: Bundle = {
        resourceType: "Bundle",
        type: "transaction",
      };

      const result = removeContainedResources({
        bundle,
        shouldRemove: () => true,
      });

      expect(result).toEqual(bundle);
      expect(result.entry).toBeUndefined();
    });

    it("preserves bundle metadata when removing contained resources", () => {
      const allergy = makeAllergyIntollerance();
      const bundle = makeBundle({
        entries: [allergy],
        type: "collection",
      });

      const result = removeContainedResources({
        bundle,
        shouldRemove: () => true,
      });

      expect(result.resourceType).toBe("Bundle");
      expect(result.type).toBe("collection");
      expect(result.entry).toHaveLength(1);
      expect(result.total).toBeUndefined();
    });

    it("handles mixed resources with and without contained arrays", () => {
      const patient = makePatient();
      const allergy = makeAllergyIntollerance({ patient });
      const containedPatient = makePatient();
      if (allergy.contained) allergy.contained.push(containedPatient);
      else allergy.contained = [containedPatient];
      const bundle = makeBundle({ entries: [patient, allergy] });

      const result = removeContainedResources({
        bundle,
        shouldRemove: resource => resource.resourceType === "Patient",
      });

      expect(result.entry).toHaveLength(2);
      expect(result.total).toBeUndefined();
      expect(result.entry?.[0]?.resource?.resourceType).toBe("Patient");
      const resultAllergy = result.entry?.[1]?.resource as any;
      expect(resultAllergy.contained).toHaveLength(0);
    });

    it("removes undefined resource when shouldRemove is true", () => {
      const bundle = makeBundle({ entries: [] });
      const entry = { resource: undefined } as any;
      if (bundle.entry) bundle.entry.push(entry);
      else bundle.entry = [entry];

      const result = removeContainedResources({
        bundle,
        shouldRemove: () => true,
      });

      expect(result.entry).toHaveLength(1);
      expect(result.total).toBeUndefined();
      expect(result.entry?.[0]?.resource).toBeUndefined();
    });
  });
});
