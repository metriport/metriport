import { CodeableConcept, Coding, Observation, Quantity } from "@medplum/fhirtypes";
import { makeObservation } from "../../fhir-to-cda/cda-templates/components/__tests__/make-observation";
import { groupSameObservations } from "../resources/observation";
import { groupSameObservationsSocial } from "../resources/observation-social";
import { unknownCode, unknownCoding } from "../shared";
import { dateTime, makePeriod } from "./examples/condition-examples";
import {
  loincCodeTobacco as loincCodeTobaccoImported,
  snomedCodeTobacco as snomedCodeTobaccoImported,
  valueConceptTobacco as valueConceptTobaccoImported,
  valueHeight as valueHeightImported,
} from "./examples/observation-examples";
import { deepClone } from "@medplum/core";

type CodeableConceptWithCoding = CodeableConcept & { coding: Coding[] };

describe("groupSameObservationsSocial", () => {
  let loincCodeTobacco: CodeableConceptWithCoding;
  let snomedCodeTobacco: CodeableConceptWithCoding;
  let valueConceptTobacco: CodeableConceptWithCoding;
  let valueHeight: Quantity;

  beforeEach(() => {
    jest.clearAllMocks();
    loincCodeTobacco = deepClone(loincCodeTobaccoImported);
    snomedCodeTobacco = deepClone(snomedCodeTobaccoImported);
    valueConceptTobacco = deepClone(valueConceptTobaccoImported);
    valueHeight = deepClone(valueHeightImported);
  });

  it("correctly groups duplicate observations based on values and loinc codes", () => {
    const params = {
      code: loincCodeTobacco,
      valueCodeableConcept: valueConceptTobacco,
    };

    const observation = makeObservation(params);
    const observation2 = makeObservation(params);

    const { observationsMap } = groupSameObservationsSocial([observation, observation2]);
    expect(observationsMap.size).toBe(1);
  });

  it("correctly groups duplicate observations based on values and snomed codes", () => {
    const params = {
      code: loincCodeTobacco,
      valueQuantity: valueHeight,
    };

    const observation = makeObservation(params);
    const observation2 = makeObservation(params);

    const { observationsMap } = groupSameObservationsSocial([observation, observation2]);
    expect(observationsMap.size).toBe(1);
  });

  it("correctly groups duplicate observations based on values and loinc codes even when snomed is present", () => {
    const params = {
      code: loincCodeTobacco,
      valueCodeableConcept: valueConceptTobacco,
    };

    const observation = makeObservation(params);
    const observation2 = makeObservation({
      ...params,
      code: { coding: [...snomedCodeTobacco.coding, ...loincCodeTobacco.coding] },
    });

    const { observationsMap } = groupSameObservationsSocial([observation, observation2]);
    expect(observationsMap.size).toBe(1);
  });

  it("correctly builds effectivePeriod on the combined observation", () => {
    const period = makePeriod();
    const period2 = makePeriod("2010-01-01T12:00:00.000Z", "2013-12-01T12:00:00.000Z");

    const params = {
      code: loincCodeTobacco,
      valueCodeableConcept: valueConceptTobacco,
    };

    const observation = makeObservation({
      ...params,
      effectivePeriod: {
        start: period.start,
        end: period.end,
      },
    });
    const observation2 = makeObservation({
      ...params,
      effectivePeriod: {
        start: period2.start,
        end: period2.end,
      },
    });

    const { observationsMap } = groupSameObservationsSocial([observation, observation2]);
    expect(observationsMap.size).toBe(1);
    const masterObs = observationsMap.values().next().value;
    expect(masterObs.effectivePeriod).toEqual({
      start: period2.start,
      end: period.end,
    });
  });

  it("does not group observations with different codes", () => {
    const params = {
      valueCodeableConcept: valueConceptTobacco,
    };

    const observation = makeObservation({ ...params, code: loincCodeTobacco });
    const observation2 = makeObservation({ ...params, code: snomedCodeTobacco });

    const { observationsMap } = groupSameObservationsSocial([observation, observation2]);
    expect(observationsMap.size).toBe(2);
  });

  it("does not group observations with different values", () => {
    const params = {
      code: loincCodeTobacco,
      valueCodeableConcept: valueConceptTobacco,
    };

    const observation = makeObservation(params);
    const observation2 = makeObservation({
      ...params,
      valueCodeableConcept: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: "12341234",
          },
        ],
      },
    });

    const { observationsMap } = groupSameObservationsSocial([observation, observation2]);
    expect(observationsMap.size).toBe(2);
  });

  it("removes observations with unknown codes", () => {
    const params = {
      valueCodeableConcept: deepClone(valueConceptTobacco),
    };

    const observation = makeObservation({ ...params, code: deepClone(loincCodeTobacco) });
    const observation2 = makeObservation({ ...params, code: deepClone(unknownCode) });

    const { observationsMap } = groupSameObservationsSocial([observation, observation2]);
    console.log("observationsMap", observationsMap);
    expect(observationsMap.size).toBe(1);
    const masterObservation = observationsMap.values().next().value as Observation;
    expect(masterObservation.code?.coding?.length).toEqual(1);
    expect(masterObservation.code?.coding).toEqual(loincCodeTobacco.coding);
  });

  it("removes unknown codes, but keeps all other codes", () => {
    const params = {
      code: deepClone(loincCodeTobacco),
      valueCodeableConcept: deepClone(valueConceptTobacco),
    };

    const madeUpCoding = {
      system: "some-other-custom-coding-system",
      code: "no-one-knows-the-meaning",
      display: "ancient words",
    };

    const observation = makeObservation(params);
    const observation2 = makeObservation({
      ...params,
      code: {
        coding: [
          deepClone(unknownCoding),
          ...deepClone(loincCodeTobacco).coding,
          ...deepClone(snomedCodeTobacco).coding,
          deepClone(madeUpCoding),
        ],
      },
    });

    const { observationsMap } = groupSameObservationsSocial([observation, observation2]);
    expect(observationsMap.size).toBe(1);
    const masterObservation = observationsMap.values().next().value as Observation;
    expect(masterObservation.code?.coding?.length).toEqual(3);
    expect(masterObservation.code?.coding).toEqual(
      expect.arrayContaining([
        ...loincCodeTobacco.coding,
        ...snomedCodeTobacco.coding,
        madeUpCoding,
      ])
    );
  });
});

describe("groupSameObservations", () => {
  let loincCodeTobacco: CodeableConceptWithCoding;
  let snomedCodeTobacco: CodeableConceptWithCoding;
  let valueHeight: Quantity;

  beforeEach(() => {
    jest.clearAllMocks();
    loincCodeTobacco = deepClone(loincCodeTobaccoImported);
    snomedCodeTobacco = deepClone(snomedCodeTobaccoImported);
    valueHeight = deepClone(valueHeightImported);
  });

  it("correctly groups duplicate observations based on values, dates, and loinc codes", () => {
    const params = {
      effectiveDateTime: dateTime.start,
      code: loincCodeTobacco,
      valueQuantity: valueHeight,
    };

    const observation = makeObservation(params);
    const observation2 = makeObservation(params);

    const { observationsMap } = groupSameObservations([observation, observation2]);
    expect(observationsMap.size).toBe(1);
  });

  it("groups observations without dates", () => {
    const params = {
      code: loincCodeTobacco,
      valueQuantity: valueHeight,
    };

    const observation = makeObservation(params);
    const observation2 = makeObservation(params);

    const { observationsMap } = groupSameObservations([observation, observation2]);
    expect(observationsMap.size).toBe(1);
  });

  it("removes observations without values", () => {
    const period = makePeriod();
    const params = {
      effectiveDateTime: period.start,
      code: loincCodeTobacco,
    };

    const observation = makeObservation(params);
    const observation2 = makeObservation(params);

    const { observationsMap } = groupSameObservations([observation, observation2]);
    expect(observationsMap.size).toBe(0);
  });
  it("removes observations without codes", () => {
    const period = makePeriod();
    const params = {
      effectiveDateTime: period.start,
      valueQuantity: valueHeight,
    };

    const observation = makeObservation(params);
    const observation2 = makeObservation(params);

    const { observationsMap } = groupSameObservations([observation, observation2]);
    expect(observationsMap.size).toBe(0);
  });

  it("does not group observations with different dates", () => {
    const period = makePeriod();
    const params = {
      code: loincCodeTobacco,
      valueQuantity: valueHeight,
    };

    const observation = makeObservation({ ...params, effectiveDateTime: period.start });
    const observation2 = makeObservation({ ...params, effectiveDateTime: period.end });

    const { observationsMap } = groupSameObservations([observation, observation2]);
    expect(observationsMap.size).toBe(2);
  });

  it("does not group observations with different codes", () => {
    const period = makePeriod();
    const params = {
      valueQuantity: valueHeight,
    };

    const observation = makeObservation({
      ...params,
      effectiveDateTime: period.start,
      code: loincCodeTobacco,
    });
    const observation2 = makeObservation({
      ...params,
      effectiveDateTime: period.end,
      code: snomedCodeTobacco,
    });

    const { observationsMap } = groupSameObservations([observation, observation2]);
    expect(observationsMap.size).toBe(2);
  });

  it("correctly groups observations with the same values", () => {
    const period = makePeriod();
    const params = {
      effectiveDateTime: period.start,
      code: loincCodeTobacco,
      valueQuantity: valueHeight,
    };

    const observation = makeObservation(params);
    const observation2 = makeObservation(params);

    const { observationsMap } = groupSameObservations([observation, observation2]);
    expect(observationsMap.size).toBe(1);
  });

  it("correctly groups observations with the same values even if one is missing the date", () => {
    const period = makePeriod();
    const params = {
      code: loincCodeTobacco,
      valueQuantity: valueHeight,
    };

    const observation = makeObservation({ ...params, effectiveDateTime: period.start });
    const observation2 = makeObservation(params);

    const { observationsMap } = groupSameObservations([observation, observation2]);
    expect(observationsMap.size).toBe(1);
  });

  it("correctly groups observations with the same values even if date is missing", () => {
    const params = {
      code: loincCodeTobacco,
      valueQuantity: valueHeight,
    };

    const observation = makeObservation(params);
    const observation2 = makeObservation(params);

    const { observationsMap } = groupSameObservations([observation, observation2]);
    expect(observationsMap.size).toBe(1);
  });

  it("does not group observations with different values", () => {
    const period = makePeriod();
    const params = {
      effectiveDateTime: period.start,
      code: loincCodeTobacco,
      valueQuantity: valueHeight,
    };

    const observation = makeObservation(params);
    const observation2 = makeObservation({
      ...params,
      valueQuantity: { ...valueHeight, value: 180 },
    });

    const { observationsMap } = groupSameObservations([observation, observation2]);
    expect(observationsMap.size).toBe(2);
  });

  it("does not group observations with different times", () => {
    const period = makePeriod();
    const params = {
      effectiveDateTime: period.start,
      code: loincCodeTobacco,
      valueQuantity: valueHeight,
    };

    const observation = makeObservation(params);
    const observation2 = makeObservation({ ...params, effectiveDateTime: period.end });

    const { observationsMap } = groupSameObservations([observation, observation2]);
    expect(observationsMap.size).toBe(2);
  });

  it("does not remove code and preserve original coding when there is only one code of unrecognized system", () => {
    const period = makePeriod();
    const originalCoding = [{ system: "some other system", code: "123", display: "some display" }];

    const params = {
      effectiveDateTime: period.start,
      code: { coding: originalCoding },
      valueQuantity: valueHeight,
    };

    const observation = makeObservation(params);
    const observation2 = makeObservation(params);

    const { observationsMap } = groupSameObservations([observation, observation2]);
    expect(observationsMap.size).toBe(1);
    const groupedObservation = observationsMap.values().next().value;
    expect(groupedObservation.code?.coding).toEqual(originalCoding);
  });

  it("does not group observations with unknown codes and different displays", () => {
    const period = makePeriod();
    const params = {
      effectiveDateTime: period.start,
      valueString: "Neg",
    };

    const observation = makeObservation({
      ...params,
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: "UNK",
            display: "unknown",
          },
          {
            display: "Leukocytes",
          },
        ],
      },
    });

    const observation2 = makeObservation({
      ...params,
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: "UNK",
            display: "unknown",
          },
          {
            display: "Bilirubin",
          },
        ],
      },
    });

    const { observationsMap } = groupSameObservations([observation, observation2]);
    expect(observationsMap.size).toBe(2);
  });

  it("does not group observations with unknown codes and different text", () => {
    const period = makePeriod();
    const params = {
      effectiveDateTime: period.start,
      valueString: "Neg",
    };

    const observation = makeObservation({
      ...params,
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: "UNK",
            display: "unknown",
          },
        ],
        text: "Leukocytes",
      },
    });

    const observation2 = makeObservation({
      ...params,
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: "UNK",
            display: "unknown",
          },
        ],
        text: "Bilirubin",
      },
    });

    const { observationsMap } = groupSameObservations([observation, observation2]);
    expect(observationsMap.size).toBe(2);
  });
});
