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
} from "../../../../../fhir-deduplication/__tests__/examples/observation-examples";
import { makeObservation } from "../../../../../fhir-to-cda/cda-templates/components/__tests__/make-observation";
import { normalizeObservations } from "../observation";

describe("normalizeObservations", () => {
  it("correctly handle temperature celsius", () => {
    const observation = makeObservation();

    observation.valueQuantity = cloneDeep(valueQuantityTempCel);

    const normalized = normalizeObservations([observation]);
    expect(normalized.length).toBe(1);
    const result = normalized[0];
    expect(result).toBeTruthy();
    if (!result) throw new Error("Expected result undefined");

    expect(result.valueQuantity?.unit).toBe("F");
    expect(result.valueQuantity?.value).toBe(98.6);
    expect(result.valueQuantity?.code).toBe("degF");
  });

  it("correctly handle temperature farhrenheit", () => {
    const observation = makeObservation();

    observation.valueQuantity = cloneDeep(valueQuantityTempF);

    const normalized = normalizeObservations([observation]);
    expect(normalized.length).toBe(1);
    const result = normalized[0];

    if (!result) throw new Error("Expected result undefined");

    expect(result.valueQuantity?.unit).toBe("F");
    expect(result.valueQuantity?.value).toBe(valueQuantityTempF.value);
    expect(result.valueQuantity?.code).toBe("degF");
  });

  it("correctly handle weight kg", () => {
    const observation = makeObservation();

    observation.valueQuantity = cloneDeep(valueQuantityWeightKg);

    const normalized = normalizeObservations([observation]);
    expect(normalized.length).toBe(1);
    const result = normalized[0];
    expect(result).toBeTruthy();
    if (!result) throw new Error("Expected result undefined");
    expect(result.valueQuantity?.unit).toBe("lb");
    expect(result.valueQuantity?.value).toBe(149.91);
  });

  it("correctly handle weight lb", () => {
    const observation = makeObservation();

    observation.valueQuantity = cloneDeep(valueQuantityWeightLb);

    const normalized = normalizeObservations([observation]);
    expect(normalized.length).toBe(1);
    const result = normalized[0];
    expect(result).toBeTruthy();
    if (!result) throw new Error("Expected result undefined");
    expect(result.valueQuantity?.unit).toBe("lb");
    expect(result.valueQuantity?.value).toBe(valueQuantityWeightLb.value);
  });

  it("correctly handle height cm", () => {
    const observation = makeObservation();

    observation.valueQuantity = cloneDeep(valueQuantityHeightCm);

    const normalized = normalizeObservations([observation]);
    expect(normalized.length).toBe(1);
    const result = normalized[0];
    expect(result).toBeTruthy();
    if (!result) throw new Error("Expected result undefined");
    expect(result.valueQuantity?.unit).toBe("in");
    expect(result.valueQuantity?.value).toBe(62.99);
  });

  it("correctly handle height in", () => {
    const observation = makeObservation();

    observation.valueQuantity = cloneDeep(valueQuantityHeightIn);

    const normalized = normalizeObservations([observation]);
    expect(normalized.length).toBe(1);
    const result = normalized[0];
    expect(result).toBeTruthy();
    if (!result) throw new Error("Expected result undefined");
    expect(result.valueQuantity?.unit).toBe("in");
    expect(result.valueQuantity?.value).toBe(valueQuantityHeightIn.value);
  });

  it("correctly handle referenceRange units", () => {
    const observation = makeObservation();

    observation.valueQuantity = cloneDeep(valueQuantityHemoglobin);
    observation.referenceRange = cloneDeep(referenceRangeHemoglobin);

    const normalized = normalizeObservations([observation]);
    expect(normalized.length).toBe(1);
    const result = normalized[0];
    expect(result).toBeTruthy();
    if (!result) throw new Error("Expected result undefined");

    expect(result.valueQuantity?.unit).toBe("g/dL");
    expect(result.valueQuantity?.value).toBe(valueQuantityHemoglobin.value);

    const rangeResult = result.referenceRange;
    expect(rangeResult).toBeTruthy();
    if (!rangeResult) throw new Error("Expected rangeResult undefined");

    expect(rangeResult.length).toBe(1);
    expect(rangeResult[0]?.low?.unit).toBe("g/dL");
    expect(rangeResult[0]?.high?.unit).toBe("g/dL");
  });

  it("correctly fills in referenceRanges units from the valueQuantity", () => {
    const observation = makeObservation();

    observation.valueQuantity = cloneDeep(valueQuantityHemoglobin);
    observation.referenceRange = cloneDeep(referenceRangeHemoglobinNoUnit);

    const normalized = normalizeObservations([observation]);
    const result = normalized[0];
    expect(result).toBeTruthy();
    if (!result) throw new Error("Expected result undefined");

    const rangeResult = result.referenceRange;
    expect(rangeResult).toBeTruthy();
    if (!rangeResult) throw new Error("Expected rangeResult undefined");

    expect(rangeResult[0]?.low?.unit).toBe("g/dL");
    expect(rangeResult[0]?.high?.unit).toBe("g/dL");
  });
});
