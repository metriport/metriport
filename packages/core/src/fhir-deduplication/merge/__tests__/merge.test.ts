import { Coding, Medication } from "@medplum/fhirtypes";
import { buildMergeFunction } from "../build-merge";
import { mergeCodeableConcepts } from "../strategy/codeable-concept";

describe("Merge test", () => {
  it("should merge two medications by order of status", () => {
    const acetaminophenCode: Coding = {
      system: "http://www.nlm.nih.gov/research/umls/rxnorm",
      code: "198440",
      display: "Acetaminophen",
    };

    const testMedication1: Medication = {
      resourceType: "Medication",
      id: "1",
      status: "active",
      code: {
        text: "Medication 1",
        coding: [acetaminophenCode],
      },
    };

    const testMedication2: Medication = {
      resourceType: "Medication",
      id: "2",
      status: "inactive",
      code: {
        text: "Medication 2",
        coding: [acetaminophenCode],
      },
    };

    const mergeMedications = buildMergeFunction<Medication>({
      statusPrecedence: ["entered-in-error", "inactive", "active"],
      mergeStrategy: {
        code: mergeCodeableConcepts,
      },
    });

    const mergedInAscendingOrder = mergeMedications([testMedication1, testMedication2]);
    const mergedInDescendingOrder = mergeMedications([testMedication2, testMedication1]);
    expect(mergedInAscendingOrder).toEqual(mergedInDescendingOrder);
  });

  // it("should merge multiple medication dispenses that are exact duplicates", () => {});
});
