import { faker } from "@faker-js/faker";
import { Observation } from "@medplum/fhirtypes";
import {
  referenceRangeHemoglobin,
  referenceRangeHemoglobinNoUnit,
  valueQuantityHeightCm,
  valueQuantityHeightIn,
  valueQuantityHemoglobin,
  valueQuantityTempCel,
  valueQuantityTempF,
  valueQuantityWeightKg,
  valueQuantityWeightLb,
} from "../../fhir-deduplication/__tests__/examples/observation-examples";
import { makeObservation } from "../../fhir-to-cda/cda-templates/components/__tests__/make-observation";
import { hydrateObservations } from "../resources/observation";

let observationId: string;
let observation: Observation;

beforeEach(() => {
  observationId = faker.string.uuid();
  observation = makeObservation({ id: observationId });
});

describe("groupSameObservations", () => {
  it("correctly handle temperature units", () => {
    observation.valueQuantity = valueQuantityTempCel;

    let hydrated = hydrateObservations([observation]);
    expect(hydrated.length).toBe(1);
    let result = hydrated[0];
    if (!result) throw new Error("Expected result undefined");

    expect(result.valueQuantity?.unit).toBe("F");
    expect(result.valueQuantity?.value).toBe(98.6);
    expect(result.valueQuantity?.code).toBe("degF");

    observation.valueQuantity = valueQuantityTempF;

    hydrated = hydrateObservations([observation]);
    expect(hydrated.length).toBe(1);
    result = hydrated[0];
    if (!result) throw new Error("Expected result undefined");

    expect(result.valueQuantity?.unit).toBe("F");
    expect(result.valueQuantity?.value).toBe(valueQuantityTempF.value);
    expect(result.valueQuantity?.code).toBe("degF");
  });

  it("correctly handle weight units", () => {
    observation.valueQuantity = valueQuantityWeightKg;

    let hydrated = hydrateObservations([observation]);
    expect(hydrated.length).toBe(1);
    let result = hydrated[0];
    if (!result) throw new Error("Expected result undefined");
    expect(result.valueQuantity?.unit).toBe("lb");
    expect(result.valueQuantity?.value).toBe(149.91);

    observation.valueQuantity = valueQuantityWeightLb;

    hydrated = hydrateObservations([observation]);
    expect(hydrated.length).toBe(1);
    result = hydrated[0];

    if (!result) throw new Error("Expected result undefined");
    expect(result.valueQuantity?.unit).toBe("lb");
    expect(result.valueQuantity?.value).toBe(valueQuantityWeightLb.value);
  });

  it("correctly handle height units", () => {
    observation.valueQuantity = valueQuantityHeightCm;

    let hydrated = hydrateObservations([observation]);
    expect(hydrated.length).toBe(1);
    let result = hydrated[0];

    if (!result) throw new Error("Expected result undefined");
    expect(result.valueQuantity?.unit).toBe("in");
    expect(result.valueQuantity?.value).toBe(62.99);

    observation.valueQuantity = valueQuantityHeightIn;

    hydrated = hydrateObservations([observation]);
    expect(hydrated.length).toBe(1);
    result = hydrated[0];

    if (!result) throw new Error("Expected result undefined");
    expect(result.valueQuantity?.unit).toBe("in");
    expect(result.valueQuantity?.value).toBe(valueQuantityHeightIn.value);
  });

  it("correctly handle referenceRange units", () => {
    observation.valueQuantity = valueQuantityHemoglobin;
    observation.referenceRange = referenceRangeHemoglobin;

    const hydrated = hydrateObservations([observation]);
    expect(hydrated.length).toBe(1);
    const result = hydrated[0];
    if (!result) throw new Error("Expected result undefined");

    expect(result.valueQuantity?.unit).toBe("g/dL");
    expect(result.valueQuantity?.value).toBe(14);

    const rangeResult = result.referenceRange;
    if (!rangeResult) throw new Error("Expected rangeResult undefined");

    expect(rangeResult.length).toBe(1);
    expect(rangeResult[0]?.low?.unit).toBe("g/dL");
    expect(rangeResult[0]?.high?.unit).toBe("g/dL");
  });

  it("correctly fills in referenceRanges units from the valueQuantity", () => {
    observation.valueQuantity = valueQuantityHemoglobin;
    observation.referenceRange = referenceRangeHemoglobinNoUnit;

    const hydrated = hydrateObservations([observation]);
    const result = hydrated[0];
    if (!result) throw new Error("Expected result undefined");

    const rangeResult = result.referenceRange;
    if (!rangeResult) throw new Error("Expected rangeResult undefined");

    expect(rangeResult[0]?.low?.unit).toBe("g/dL");
    expect(rangeResult[0]?.high?.unit).toBe("g/dL");
  });
});
