import { faker } from "@faker-js/faker";
import { Observation } from "@medplum/fhirtypes";
import { makeObservation } from "../../fhir-to-cda/cda-templates/components/__tests__/make-observation";
import { groupSameObservations } from "../resources/observation";
import { groupSameObservationsSocial } from "../resources/observation-social";
import { unknownCode, unknownCoding } from "../shared";
import { dateTime, dateTime2 } from "./examples/condition-examples";
import {
  loincCodeTobacco,
  snomedCodeTobacco,
  valueConceptTobacco,
  valueHeight,
} from "./examples/observation-examples";

let observationId: string;
let observationId2: string;
let observation: Observation;
let observation2: Observation;

beforeEach(() => {
  observationId = faker.string.uuid();
  observationId2 = faker.string.uuid();
  observation = makeObservation({ id: observationId });
  observation2 = makeObservation({ id: observationId2 });
});

describe("groupSameObservationsSocial", () => {
  it("correctly groups duplicate observations based on values and loinc codes", () => {
    observation.code = loincCodeTobacco;
    observation2.code = loincCodeTobacco;
    observation.valueCodeableConcept = valueConceptTobacco;
    observation2.valueCodeableConcept = valueConceptTobacco;

    const { observationsMap } = groupSameObservationsSocial([observation, observation2]);
    expect(observationsMap.size).toBe(1);
  });

  it("correctly groups duplicate observations based on values and snomed codes", () => {
    observation.code = snomedCodeTobacco;
    observation2.code = snomedCodeTobacco;
    observation.valueCodeableConcept = valueConceptTobacco;
    observation2.valueCodeableConcept = valueConceptTobacco;

    const { observationsMap } = groupSameObservationsSocial([observation, observation2]);
    expect(observationsMap.size).toBe(1);
  });

  it("correctly groups duplicate observations based on values and loinc codes even when snomed is present", () => {
    observation.code = { coding: [...snomedCodeTobacco.coding, ...loincCodeTobacco.coding] };
    observation2.code = loincCodeTobacco;
    observation.valueCodeableConcept = valueConceptTobacco;
    observation2.valueCodeableConcept = valueConceptTobacco;

    const { observationsMap } = groupSameObservationsSocial([observation, observation2]);
    expect(observationsMap.size).toBe(1);
  });

  it("correctly builds effectivePeriod on the combined observation", () => {
    observation.effectivePeriod = {
      start: dateTime.start,
      end: dateTime2.start,
    };
    observation2.effectivePeriod = {
      start: "2010-01-01T12:00:00.000Z",
      end: "2013-12-01T12:00:00.000Z",
    };
    observation.code = loincCodeTobacco;
    observation2.code = loincCodeTobacco;
    observation.valueCodeableConcept = valueConceptTobacco;
    observation2.valueCodeableConcept = valueConceptTobacco;

    const { observationsMap } = groupSameObservationsSocial([observation, observation2]);
    expect(observationsMap.size).toBe(1);
    const masterObs = observationsMap.values().next().value;
    expect(masterObs.effectivePeriod).toEqual({
      start: "2010-01-01T12:00:00.000Z",
      end: "2014-02-01T10:00:00.000Z",
    });
  });

  it("does not group observations with different codes", () => {
    observation.code = loincCodeTobacco;
    observation2.code = snomedCodeTobacco;
    observation.valueCodeableConcept = valueConceptTobacco;
    observation2.valueCodeableConcept = valueConceptTobacco;

    const { observationsMap } = groupSameObservationsSocial([observation, observation2]);
    expect(observationsMap.size).toBe(2);
  });

  it("does not group observations with different values", () => {
    observation.code = loincCodeTobacco;
    observation2.code = loincCodeTobacco;
    observation.valueCodeableConcept = valueConceptTobacco;
    observation2.valueCodeableConcept = {
      coding: [
        {
          system: "http://snomed.info/sct",
          code: "12341234",
        },
      ],
    };

    const { observationsMap } = groupSameObservationsSocial([observation, observation2]);
    expect(observationsMap.size).toBe(2);
  });

  it("removes observations with unknown codes", () => {
    observation.code = loincCodeTobacco;
    observation2.code = unknownCode;
    observation.valueCodeableConcept = valueConceptTobacco;
    observation2.valueCodeableConcept = valueConceptTobacco;

    const { observationsMap } = groupSameObservationsSocial([observation, observation2]);
    expect(observationsMap.size).toBe(1);
    const masterObservation = observationsMap.values().next().value as Observation;
    expect(masterObservation.code?.coding?.length).toEqual(1);
    expect(masterObservation.code?.coding).toEqual(loincCodeTobacco.coding);
  });

  it("removes unknown codes, but keeps all other codes", () => {
    observation.code = loincCodeTobacco;
    const madeUpCoding = {
      system: "some-other-custom-coding-system",
      code: "no-one-knows-the-meaning",
      display: "ancient words",
    };
    observation2.code = {
      coding: [
        unknownCoding,
        ...loincCodeTobacco.coding,
        ...snomedCodeTobacco.coding,
        madeUpCoding,
      ],
    };
    observation.valueCodeableConcept = valueConceptTobacco;
    observation2.valueCodeableConcept = valueConceptTobacco;

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
  it("correctly groups duplicate observations based on values, dates, and loinc codes", () => {
    observation.effectiveDateTime = dateTime.start;
    observation2.effectiveDateTime = dateTime.start;
    observation.code = loincCodeTobacco;
    observation2.code = loincCodeTobacco;
    observation.valueQuantity = valueHeight;
    observation2.valueQuantity = valueHeight;

    const { observationsMap } = groupSameObservations([observation, observation2]);
    expect(observationsMap.size).toBe(1);
  });

  it("groups observations without dates", () => {
    observation.code = loincCodeTobacco;
    observation2.code = loincCodeTobacco;
    observation.valueQuantity = valueHeight;
    observation2.valueQuantity = valueHeight;

    const { observationsMap } = groupSameObservations([observation, observation2]);
    expect(observationsMap.size).toBe(1);
  });

  it("removes observations without values", () => {
    observation.effectiveDateTime = dateTime.start;
    observation2.effectiveDateTime = dateTime.start;
    observation.code = loincCodeTobacco;
    observation2.code = loincCodeTobacco;

    const { observationsMap } = groupSameObservations([observation, observation2]);
    expect(observationsMap.size).toBe(0);
  });
  it("removes observations without codes", () => {
    observation.effectiveDateTime = dateTime.start;
    observation2.effectiveDateTime = dateTime.start;
    observation.valueQuantity = valueHeight;
    observation2.valueQuantity = valueHeight;

    const { observationsMap } = groupSameObservations([observation, observation2]);
    expect(observationsMap.size).toBe(0);
  });

  it("does not group observations with different dates", () => {
    observation.effectiveDateTime = dateTime.start;
    observation2.effectiveDateTime = dateTime2.start;
    observation.code = loincCodeTobacco;
    observation2.code = loincCodeTobacco;
    observation.valueQuantity = valueHeight;
    observation2.valueQuantity = valueHeight;

    const { observationsMap } = groupSameObservations([observation, observation2]);
    expect(observationsMap.size).toBe(2);
  });

  it("does not group observations with different codes", () => {
    observation.effectiveDateTime = dateTime.start;
    observation2.effectiveDateTime = dateTime2.start;
    observation.code = loincCodeTobacco;
    observation2.code = snomedCodeTobacco;
    observation.valueQuantity = valueHeight;
    observation2.valueQuantity = valueHeight;

    const { observationsMap } = groupSameObservations([observation, observation2]);
    expect(observationsMap.size).toBe(2);
  });

  it("correctly groups observations with the same values", () => {
    observation.effectiveDateTime = dateTime.start;
    observation2.effectiveDateTime = dateTime.start;
    observation.code = loincCodeTobacco;
    observation2.code = loincCodeTobacco;
    observation.valueQuantity = valueHeight;
    observation2.valueQuantity = valueHeight;

    const { observationsMap } = groupSameObservations([observation, observation2]);
    expect(observationsMap.size).toBe(1);
  });

  it("correctly groups observations with the same values even if one is missing the date", () => {
    observation.effectiveDateTime = dateTime.start;
    observation.code = loincCodeTobacco;
    observation2.code = loincCodeTobacco;
    observation.valueQuantity = valueHeight;
    observation2.valueQuantity = valueHeight;

    const { observationsMap } = groupSameObservations([observation, observation2]);
    expect(observationsMap.size).toBe(1);
  });

  it("correctly groups observations with the same values even if date is missing", () => {
    observation.code = loincCodeTobacco;
    observation2.code = loincCodeTobacco;
    observation.valueQuantity = valueHeight;
    observation2.valueQuantity = valueHeight;

    const { observationsMap } = groupSameObservations([observation, observation2]);
    expect(observationsMap.size).toBe(1);
  });

  it("does not group observations with different values", () => {
    observation.effectiveDateTime = dateTime.start;
    observation2.effectiveDateTime = dateTime.start;
    observation.code = loincCodeTobacco;
    observation2.code = loincCodeTobacco;
    observation.valueQuantity = valueHeight;
    observation2.valueQuantity = { ...valueHeight, value: 180 };

    const { observationsMap } = groupSameObservations([observation, observation2]);
    expect(observationsMap.size).toBe(2);
  });

  it("does not group observations with different times", () => {
    observation.effectiveDateTime = dateTime.start;
    observation2.effectiveDateTime = dateTime2.start;
    observation.code = loincCodeTobacco;
    observation2.code = loincCodeTobacco;
    observation.valueQuantity = valueHeight;
    observation2.valueQuantity = valueHeight;

    const { observationsMap } = groupSameObservations([observation, observation2]);
    expect(observationsMap.size).toBe(2);
  });

  it("does not remove code and preserve original coding when there is only one code of unrecognized system", () => {
    observation.effectiveDateTime = dateTime.start;
    observation2.effectiveDateTime = dateTime.start;
    const originalCoding = [{ system: "some other system", code: "123", display: "some display" }];

    observation.code = { coding: originalCoding };
    observation2.code = { coding: originalCoding };
    observation.valueQuantity = valueHeight;
    observation2.valueQuantity = valueHeight;

    const { observationsMap } = groupSameObservations([observation, observation2]);
    expect(observationsMap.size).toBe(1);
    const groupedObservation = observationsMap.values().next().value;
    expect(groupedObservation.code?.coding).toEqual(originalCoding);
  });

  it("does not group observations with unknown codes and different displays", () => {
    observation = makeObservation({
      id: observationId,
      effectiveDateTime: "2023-11-17T09:32:00.000Z",
      valueString: "Neg",
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

    observation2 = makeObservation({
      id: observationId2,
      effectiveDateTime: "2023-11-17T09:32:00.000Z",
      valueString: "Neg",
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
    observation = makeObservation({
      id: observationId,
      effectiveDateTime: "2023-11-17T09:32:00.000Z",
      valueString: "Neg",
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

    observation2 = makeObservation({
      id: observationId2,
      effectiveDateTime: "2023-11-17T09:32:00.000Z",
      valueString: "Neg",
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
