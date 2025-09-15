import { faker } from "@faker-js/faker";
import { Coding, CodeableConcept, Medication } from "@medplum/fhirtypes";
import { buildMedicationMergeFunction } from "../resource/medication";

function makeMedication({
  id = faker.string.uuid(),
  lastUpdated,
  source,
  code,
  status,
}: {
  id?: string;
  lastUpdated?: string;
  source?: string;
  code: CodeableConcept;
  status: Medication["status"];
}): Medication {
  return {
    resourceType: "Medication",
    id,
    ...(lastUpdated ? { meta: { lastUpdated, ...(source ? { source } : {}) } } : {}),
    ...(code ? { code } : {}),
    ...(status ? { status } : {}),
  };
}

describe("Merge medications", () => {
  const mergeMedications = buildMedicationMergeFunction();

  it("should merge two medications by order of last updated", () => {
    const acetaminophenCode: Coding = {
      system: "http://www.nlm.nih.gov/research/umls/rxnorm",
      code: "198440",
      display: "Acetaminophen",
    };

    const firstMedication = makeMedication({
      id: "1",
      lastUpdated: "2024-01-01T00:00:00.000Z",
      code: {
        text: "Medication 1",
        coding: [acetaminophenCode],
      },
      status: "active",
    });

    const laterMedication = makeMedication({
      id: "2",
      lastUpdated: "2025-01-02T00:00:00.000Z",
      code: {
        text: "Medication 2",
        coding: [acetaminophenCode],
      },
      status: "inactive",
    });

    const mergedInAscendingOrder = mergeMedications([firstMedication, laterMedication]);
    const mergedInDescendingOrder = mergeMedications([laterMedication, firstMedication]);
    expect(mergedInAscendingOrder).toEqual(laterMedication);
    expect(mergedInDescendingOrder).toEqual(laterMedication);
  });

  it("should merge multiple medications that do not have meta", () => {
    const firstMedication = makeMedication({
      id: "1",
      status: "active",
      code: {
        coding: [{ code: "a", system: "b" }],
      },
    });

    const secondMedication = makeMedication({
      id: "2",
      status: "inactive",
      code: {
        coding: [{ code: "a", system: "b" }],
      },
    });

    const merged = mergeMedications([firstMedication, secondMedication]);
    expect(merged).toEqual(secondMedication);

    const anotherMerged = mergeMedications([secondMedication, firstMedication]);
    expect(anotherMerged).toEqual(firstMedication);
  });
});
