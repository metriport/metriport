import { faker } from "@faker-js/faker";
import { Observation } from "@medplum/fhirtypes";
import { makeObservation } from "../../fhir-to-cda/cda-templates/components/__tests__/make-observation";
import { groupSameObservationsSocial } from "../resources/observation-social";
import { dateTime, dateTime2 } from "./examples/condition-examples";
import { loincCodeTb, snomedCodeTb, valueConceptTb } from "./examples/observation-examples";

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

describe("groupSameObservations", () => {
  it("correctly groups duplicate observations based on cvx codes and dates", () => {
    observation.effectiveDateTime = dateTime.start;
    observation2.effectiveDateTime = dateTime2.start;
    observation.code = loincCodeTb;
    observation2.code = loincCodeTb;
    observation.valueCodeableConcept = valueConceptTb;
    observation2.valueCodeableConcept = valueConceptTb;

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
    observation.code = loincCodeTb;
    observation2.code = loincCodeTb;
    observation.valueCodeableConcept = valueConceptTb;
    observation2.valueCodeableConcept = valueConceptTb;

    const { observationsMap } = groupSameObservationsSocial([observation, observation2]);
    expect(observationsMap.size).toBe(1);
    const masterObs = observationsMap.values().next().value;
    expect(masterObs.effectivePeriod).toEqual({
      start: "2010-01-01T12:00:00.000Z",
      end: "2014-02-01T10:00:00.000Z",
    });
  });

  it("does not group observations with different codes", () => {
    observation.code = loincCodeTb;
    observation2.code = snomedCodeTb;
    observation.valueCodeableConcept = valueConceptTb;
    observation2.valueCodeableConcept = valueConceptTb;

    const { observationsMap } = groupSameObservationsSocial([observation, observation2]);
    expect(observationsMap.size).toBe(2);
  });

  it("does not group observations with different values", () => {
    observation.code = loincCodeTb;
    observation2.code = loincCodeTb;
    observation.valueCodeableConcept = valueConceptTb;
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

  it("removes observations with invalid codes", () => {
    observation.code = loincCodeTb;
    observation2.code = {
      coding: [{ ...snomedCodeTb.coding[0], system: "some-other-code-system" }],
    };
    observation.valueCodeableConcept = valueConceptTb;
    observation2.valueCodeableConcept = valueConceptTb;

    const { observationsMap } = groupSameObservationsSocial([observation, observation2]);
    expect(observationsMap.size).toBe(1);
    const masterObservation = observationsMap.values().next().value as Observation;
    expect(masterObservation.code?.coding?.length).toEqual(1);
    expect(masterObservation.code?.coding).toEqual(loincCodeTb.coding);
  });
});
