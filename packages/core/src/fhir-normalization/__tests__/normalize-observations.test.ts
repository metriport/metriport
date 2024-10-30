import { faker } from "@faker-js/faker";
import { Observation } from "@medplum/fhirtypes";
import { cloneDeep } from "lodash";
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
import { normalizeObservations } from "../resources/observation";

let observationId: string;
let observation: Observation;

beforeEach(() => {
  observationId = faker.string.uuid();
  observation = makeObservation({ id: observationId });
});

describe("normalizeObservations", () => {
  it("correctly handle temperature units", () => {
    observation.valueQuantity = cloneDeep(valueQuantityTempCel);

    let hydrated = normalizeObservations([observation]);
    expect(hydrated.length).toBe(1);
    let result = hydrated[0];
    if (!result) throw new Error("Expected result undefined");

    expect(result.valueQuantity?.unit).toBe("F");
    expect(result.valueQuantity?.value).toBe(98.6);
    expect(result.valueQuantity?.code).toBe("degF");

    observation.valueQuantity = cloneDeep(valueQuantityTempF);

    hydrated = normalizeObservations([observation]);
    expect(hydrated.length).toBe(1);
    result = hydrated[0];
    if (!result) throw new Error("Expected result undefined");

    expect(result.valueQuantity?.unit).toBe("F");
    expect(result.valueQuantity?.value).toBe(valueQuantityTempF.value);
    expect(result.valueQuantity?.code).toBe("degF");
  });

  it("correctly handle weight units", () => {
    observation.valueQuantity = cloneDeep(valueQuantityWeightKg);

    let hydrated = normalizeObservations([observation]);
    expect(hydrated.length).toBe(1);
    let result = hydrated[0];
    if (!result) throw new Error("Expected result undefined");
    expect(result.valueQuantity?.unit).toBe("lb");
    expect(result.valueQuantity?.value).toBe(149.91);

    observation.valueQuantity = cloneDeep(valueQuantityWeightLb);

    hydrated = normalizeObservations([observation]);
    expect(hydrated.length).toBe(1);
    result = hydrated[0];

    if (!result) throw new Error("Expected result undefined");
    expect(result.valueQuantity?.unit).toBe("lb");
    expect(result.valueQuantity?.value).toBe(valueQuantityWeightLb.value);
  });

  it("correctly handle height units", () => {
    observation.valueQuantity = cloneDeep(valueQuantityHeightCm);

    let hydrated = normalizeObservations([observation]);
    expect(hydrated.length).toBe(1);
    let result = hydrated[0];

    if (!result) throw new Error("Expected result undefined");
    expect(result.valueQuantity?.unit).toBe("in");
    expect(result.valueQuantity?.value).toBe(62.99);

    observation.valueQuantity = cloneDeep(valueQuantityHeightIn);

    hydrated = normalizeObservations([observation]);
    expect(hydrated.length).toBe(1);
    result = hydrated[0];

    if (!result) throw new Error("Expected result undefined");
    expect(result.valueQuantity?.unit).toBe("in");
    expect(result.valueQuantity?.value).toBe(valueQuantityHeightIn.value);
  });

  it("correctly handle referenceRange units", () => {
    observation.valueQuantity = cloneDeep(valueQuantityHemoglobin);
    observation.referenceRange = cloneDeep(referenceRangeHemoglobin);

    const hydrated = normalizeObservations([observation]);
    expect(hydrated.length).toBe(1);
    const result = hydrated[0];
    if (!result) throw new Error("Expected result undefined");

    expect(result.valueQuantity?.unit).toBe("g/dL");
    expect(result.valueQuantity?.value).toBe(valueQuantityHemoglobin.value);

    const rangeResult = result.referenceRange;
    if (!rangeResult) throw new Error("Expected rangeResult undefined");

    expect(rangeResult.length).toBe(1);
    expect(rangeResult[0]?.low?.unit).toBe("g/dL");
    expect(rangeResult[0]?.high?.unit).toBe("g/dL");
  });

  it("correctly fills in referenceRanges units from the valueQuantity", () => {
    observation.valueQuantity = cloneDeep(valueQuantityHemoglobin);
    observation.referenceRange = cloneDeep(referenceRangeHemoglobinNoUnit);

    const hydrated = normalizeObservations([observation]);
    const result = hydrated[0];
    if (!result) throw new Error("Expected result undefined");

    const rangeResult = result.referenceRange;
    if (!rangeResult) throw new Error("Expected rangeResult undefined");

    expect(rangeResult[0]?.low?.unit).toBe("g/dL");
    expect(rangeResult[0]?.high?.unit).toBe("g/dL");
  });
});
