import { faker } from "@faker-js/faker";
import { Medication } from "@medplum/fhirtypes";
import { makeMedication } from "../../fhir-to-cda/cda-templates/components/__tests__/make-medication";
import { groupSameMedications } from "../resources/medication";
import {
  snomedCodeAm,
  rxnormCodeAm,
  ndcCodeAm,
  snomedCodePn,
  rxnormCodePn,
  ndcCodePn,
} from "./examples/medication-examples";

let medicationId: string;
let medicationId2: string;
let medication: Medication;
let medication2: Medication;

beforeEach(() => {
  medicationId = faker.string.uuid();
  medicationId2 = faker.string.uuid();
  medication = makeMedication({ id: medicationId });
  medication2 = makeMedication({ id: medicationId2 });
});

describe("groupSameMedications", () => {
  it("correctly groups duplicate medications based on rxnorm codes", () => {
    medication.code = { coding: [rxnormCodeAm] };
    medication2.code = { coding: [rxnormCodeAm] };

    const { rxnormMap, ndcMap, snomedMap } = groupSameMedications([medication, medication2]);
    expect(rxnormMap.size).toBe(1);
    expect(ndcMap.size).toBe(0);
    expect(snomedMap.size).toBe(0);
  });

  it("correctly groups duplicate medications based on ndc codes", () => {
    medication.code = { coding: [ndcCodeAm] };
    medication2.code = { coding: [ndcCodeAm] };

    const { rxnormMap, ndcMap, snomedMap } = groupSameMedications([medication, medication2]);
    expect(rxnormMap.size).toBe(0);
    expect(ndcMap.size).toBe(1);
    expect(snomedMap.size).toBe(0);
  });

  it("correctly groups duplicate medications based on snomed codes", () => {
    medication.code = { coding: [snomedCodeAm] };
    medication2.code = { coding: [snomedCodeAm] };

    const { rxnormMap, ndcMap, snomedMap } = groupSameMedications([medication, medication2]);
    expect(rxnormMap.size).toBe(0);
    expect(ndcMap.size).toBe(0);
    expect(snomedMap.size).toBe(1);
  });

  it("removes no known medication resources based on the text tag", () => {
    medication.code = { coding: [snomedCodeAm], text: "No known medication" };

    const { rxnormMap, ndcMap, snomedMap } = groupSameMedications([medication]);
    expect(rxnormMap.size).toBe(0);
    expect(ndcMap.size).toBe(0);
    expect(snomedMap.size).toBe(0);
  });

  it("does not group duplicate medications that don't have overlapping codes", () => {
    medication.code = { coding: [rxnormCodeAm] };
    medication2.code = { coding: [ndcCodeAm] };

    const { rxnormMap, ndcMap, snomedMap } = groupSameMedications([medication, medication2]);
    expect(rxnormMap.size).toBe(1);
    expect(ndcMap.size).toBe(1);
    expect(snomedMap.size).toBe(0);
  });

  it("removes medications that have neither of the expected codes", () => {
    medication.code = { coding: [rxnormCodeAm] };
    medication2.code = { coding: [{ system: "some other system", code: "123" }] };

    const { rxnormMap, ndcMap, snomedMap } = groupSameMedications([medication, medication2]);
    expect(rxnormMap.size).toBe(1);
    expect(ndcMap.size).toBe(0);
    expect(snomedMap.size).toBe(0);
  });

  it("strips out irrelevant codes", () => {
    medication.code = { coding: [rxnormCodeAm] };
    medication2.code = { coding: [rxnormCodeAm, { system: "some other system", code: "123" }] };

    const { rxnormMap, ndcMap, snomedMap } = groupSameMedications([medication, medication2]);
    expect(rxnormMap.size).toBe(1);
    const masterMedication = rxnormMap.values().next().value;
    expect(masterMedication.code?.coding.length).toBe(1);
    expect(masterMedication.code).toEqual(
      expect.objectContaining({
        coding: expect.arrayContaining([
          expect.objectContaining({
            system: rxnormCodeAm.system,
          }),
        ]),
      })
    );
    expect(ndcMap.size).toBe(0);
    expect(snomedMap.size).toBe(0);
  });

  it("does not group medications with different codes", () => {
    // rxnorm
    medication.code = { coding: [rxnormCodeAm] };
    medication2.code = { coding: [rxnormCodePn] };
    const { rxnormMap } = groupSameMedications([medication, medication2]);
    expect(rxnormMap.size).toBe(2);

    // ndc
    medication.code = { coding: [ndcCodeAm] };
    medication2.code = { coding: [ndcCodePn] };
    const { ndcMap } = groupSameMedications([medication, medication2]);
    expect(ndcMap.size).toBe(2);

    // snomed
    medication.code = { coding: [snomedCodeAm] };
    medication2.code = { coding: [snomedCodePn] };
    const { snomedMap } = groupSameMedications([medication, medication2]);
    expect(snomedMap.size).toBe(2);
  });

  it("does not save the extensions for the medications", () => {
    medication.code = { coding: [rxnormCodeAm] };
    medication2.code = { coding: [rxnormCodeAm] };

    const { rxnormMap } = groupSameMedications([medication, medication2]);
    const combinedMedication = rxnormMap.get(rxnormCodeAm.code);
    expect(combinedMedication).toBeTruthy();
    expect(combinedMedication?.extension).toBe(undefined);
  });
});
