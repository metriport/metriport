import {
  referenceRangeHemoglobin,
  referenceRangeHemoglobinNoUnit,
  valueQuantityHeightCm,
  valueQuantityHeightIn,
  valueQuantityHemoglobin,
  valueQuantityTempCel,
  valueQuantityTempF,
  valueQuantityWeightG,
  valueQuantityWeightKg,
  valueQuantityWeightLb,
} from "../../../../../fhir-deduplication/__tests__/examples/observation-examples";
import { makeObservation } from "../../../../../fhir-to-cda/cda-templates/components/__tests__/make-observation";
import {
  calculateInterpretationCode,
  normalizeInterpretationStringToCode,
  normalizeObservations,
} from "../observation";

describe("normalizeObservations", () => {
  it("correctly handle temperature celsius", () => {
    const observation = makeObservation({ valueQuantity: valueQuantityTempCel });

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
    const observation = makeObservation({ valueQuantity: valueQuantityTempF });

    const normalized = normalizeObservations([observation]);
    expect(normalized.length).toBe(1);
    const result = normalized[0];
    if (!result) throw new Error("Expected result undefined");

    expect(result.valueQuantity?.unit).toBe("F");
    expect(result.valueQuantity?.value).toBe(valueQuantityTempF.value);
    expect(result.valueQuantity?.code).toBe("degF");
  });

  it("correctly handle weight kg", () => {
    const observation = makeObservation({ valueQuantity: valueQuantityWeightKg });

    const normalized = normalizeObservations([observation]);
    expect(normalized.length).toBe(1);
    const result = normalized[0];
    expect(result).toBeTruthy();
    if (!result) throw new Error("Expected result undefined");
    expect(result.valueQuantity?.unit).toBe("kg");
    expect(result.valueQuantity?.value).toBe(68);
  });

  it("correctly handle weight lb", () => {
    const observation = makeObservation({ valueQuantity: valueQuantityWeightLb });

    const normalized = normalizeObservations([observation]);
    expect(normalized.length).toBe(1);
    const result = normalized[0];
    expect(result).toBeTruthy();
    if (!result) throw new Error("Expected result undefined");
    expect(result.valueQuantity?.unit).toBe("kg");
    expect(result.valueQuantity?.value).toBe(72.57);
  });

  it("correctly handle weight g", () => {
    const observation = makeObservation({ valueQuantity: valueQuantityWeightG });

    const normalized = normalizeObservations([observation]);
    expect(normalized.length).toBe(1);
    const result = normalized[0];
    expect(result).toBeTruthy();
    if (!result) throw new Error("Expected result undefined");
    expect(result.valueQuantity?.unit).toBe("kg");
    expect(result.valueQuantity?.value).toBe(12.5);
  });

  it("correctly handle height cm", () => {
    const observation = makeObservation({ valueQuantity: valueQuantityHeightCm });

    const normalized = normalizeObservations([observation]);
    expect(normalized.length).toBe(1);
    const result = normalized[0];
    expect(result).toBeTruthy();
    if (!result) throw new Error("Expected result undefined");
    expect(result.valueQuantity?.unit).toBe("cm");
    expect(result.valueQuantity?.value).toBe(160);
  });

  it("correctly handle height in", () => {
    const observation = makeObservation({ valueQuantity: valueQuantityHeightIn });

    const normalized = normalizeObservations([observation]);
    expect(normalized.length).toBe(1);
    const result = normalized[0];
    expect(result).toBeTruthy();
    if (!result) throw new Error("Expected result undefined");
    expect(result.valueQuantity?.unit).toBe("cm");
    expect(result.valueQuantity?.value).toBe(152.4);
  });

  it("correctly handle referenceRange units", () => {
    const observation = makeObservation({
      valueQuantity: valueQuantityHemoglobin,
      referenceRange: referenceRangeHemoglobin,
    });

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
    const observation = makeObservation({
      valueQuantity: valueQuantityHemoglobin,
      referenceRange: referenceRangeHemoglobinNoUnit,
    });

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

  it("correctly calculates interpretation to be normal based on value and reference range", () => {
    const observation = makeObservation({
      valueQuantity: valueQuantityHemoglobin,
      referenceRange: referenceRangeHemoglobin,
    });

    const normalized = normalizeObservations([observation]);
    expect(normalized.length).toBe(1);
    const obs = normalized[0];
    expect(obs).toBeTruthy();
    if (!obs) throw new Error("Expected result undefined");

    expect(obs.interpretation?.[0]?.text).toEqual("Normal");
    expect(obs.interpretation?.[0]?.coding?.[0]?.code).toEqual("N");
  });

  it("correctly calculates interpretation to be low based on value and reference range", () => {
    const observation = makeObservation({
      valueQuantity: { ...valueQuantityHemoglobin, value: 1.0 },
      referenceRange: referenceRangeHemoglobin,
    });

    const normalized = normalizeObservations([observation]);
    expect(normalized.length).toBe(1);
    const obs = normalized[0];
    expect(obs).toBeTruthy();
    if (!obs) throw new Error("Expected result undefined");

    expect(obs.interpretation?.[0]?.text).toEqual("Low");
    expect(obs.interpretation?.[0]?.coding?.[0]?.code).toEqual("L");
  });

  it("correctly calculates interpretation to be high based on value and reference range", () => {
    const observation = makeObservation({
      valueQuantity: { ...valueQuantityHemoglobin, value: 20 },
      referenceRange: referenceRangeHemoglobin,
    });

    const normalized = normalizeObservations([observation]);
    expect(normalized.length).toBe(1);
    const obs = normalized[0];
    expect(obs).toBeTruthy();
    if (!obs) throw new Error("Expected result undefined");

    expect(obs.interpretation?.[0]?.text).toEqual("High");
    expect(obs.interpretation?.[0]?.coding?.[0]?.code).toEqual("H");
  });

  it("correctly keeps existing interpretation", () => {
    const observation = makeObservation({
      valueQuantity: { ...valueQuantityHemoglobin, value: 0.001 },
      referenceRange: referenceRangeHemoglobin,
      interpretation: [
        {
          text: "critically low",
        },
      ],
    });
    console.log("observation before", JSON.stringify(observation, null, 2));

    const normalized = normalizeObservations([observation]);
    console.log("normalized before", JSON.stringify(normalized, null, 2));
    expect(normalized.length).toBe(1);
    const obs = normalized[0];
    expect(obs).toBeTruthy();
    if (!obs) throw new Error("Expected result undefined");

    expect(obs.interpretation?.[0]?.coding?.[0]?.code).toBeUndefined();
    expect(obs.interpretation?.[0]?.text).toEqual("critically low");
  });

  it("creates a correct interpretation based on valueString", () => {
    const observation = makeObservation({
      valueString: "Normal",
    });

    const normalized = normalizeObservations([observation]);
    expect(normalized.length).toBe(1);
    const obs = normalized[0];
    expect(obs).toBeTruthy();
    if (!obs) throw new Error("Expected result undefined");

    expect(obs.interpretation?.[0]?.text).toEqual("Normal");
    expect(obs.interpretation?.[0]?.coding?.[0]?.code).toEqual("N");
  });

  describe("calculateInterpretationCode", () => {
    it("returns correct code for a numeric value within range", () => {
      const value = 10;
      const range = { low: 5, high: 15, unit: "units" };
      const result = calculateInterpretationCode(value, range);
      expect(result).toEqual("N");
    });

    it("returns correct code for a numeric value below range", () => {
      const value = 3;
      const range = { low: 5, high: 15, unit: "units" };
      const result = calculateInterpretationCode(value, range);
      expect(result).toEqual("L");
    });

    it("returns correct code for a numeric value above range", () => {
      const value = 20;
      const range = { low: 5, high: 15, unit: "units" };
      const result = calculateInterpretationCode(value, range);
      expect(result).toEqual("H");
    });

    it("returns undefined when neither low nor high provided in the range", () => {
      const value = 20;
      const range = { low: undefined, high: undefined, unit: "units" };
      const result = calculateInterpretationCode(value, range);
      expect(result).toEqual(undefined);
    });
  });

  describe("normalizeInterpretationStringToCode", () => {
    it("returns correct code for a value containing `normal`", () => {
      const value = "normal";
      const result = normalizeInterpretationStringToCode(value);
      expect(result).toEqual("N");
    });

    it("returns correct code for a value containing `not detected`", () => {
      const value = "not detected";
      const result = normalizeInterpretationStringToCode(value);
      expect(result).toEqual("N");
    });

    it("returns correct code for a value containing `negative`", () => {
      const value = "negative";
      const result = normalizeInterpretationStringToCode(value);
      expect(result).toEqual("N");
    });

    it("returns correct code for a value containing `abnormal`", () => {
      const value = "abnormal";
      const result = normalizeInterpretationStringToCode(value);
      expect(result).toEqual("A");
    });

    it("returns correct code for a value containing `low`", () => {
      const value = "low";
      const result = normalizeInterpretationStringToCode(value);
      expect(result).toEqual("L");
    });

    it("returns correct code for a value containing `high`", () => {
      const value = "high";
      const result = normalizeInterpretationStringToCode(value);
      expect(result).toEqual("H");
    });
  });

  describe("normalizeReferenceRanges", () => {
    it("correctly normalizes reference range units", () => {
      const observation = makeObservation({
        valueQuantity: { ...valueQuantityTempCel },
        referenceRange: [
          {
            low: { value: 36.5, unit: "C" },
            high: { value: 37.5, unit: "C" },
          },
        ],
      });

      const normalized = normalizeObservations([observation]);
      expect(normalized.length).toBe(1);
      const result = normalized[0];
      expect(result).toBeTruthy();
      if (!result) throw new Error("Expected result to be defined");

      const rangeResult = result.referenceRange;
      expect(rangeResult).toBeTruthy();
      if (!rangeResult) throw new Error("Expected rangeResult to be defined");

      expect(rangeResult[0]?.low?.unit).toBe("F");
      expect(rangeResult[0]?.low?.value).toBe(97.7);
      expect(rangeResult[0]?.high?.unit).toBe("F");
      expect(rangeResult[0]?.high?.value).toBe(99.5);
    });

    it("correctly fills in missing units from valueQuantity", () => {
      const observation = makeObservation({
        valueQuantity: { ...valueQuantityTempF },
        referenceRange: [
          {
            low: { value: 97.7 },
            high: { value: 99.5 },
          },
        ],
      });

      const normalized = normalizeObservations([observation]);
      expect(normalized.length).toBe(1);
      const result = normalized[0];
      expect(result).toBeTruthy();
      if (!result) throw new Error("Expected result to be defined");

      const rangeResult = result.referenceRange;
      expect(rangeResult).toBeTruthy();
      if (!rangeResult) throw new Error("Expected rangeResult to be defined");

      expect(rangeResult[0]?.low?.unit).toBe("F");
      expect(rangeResult[0]?.low?.value).toBe(97.7);
      expect(rangeResult[0]?.high?.unit).toBe("F");
      expect(rangeResult[0]?.high?.value).toBe(99.5);
    });

    it("handles reference ranges with only low value", () => {
      const observation = makeObservation({
        valueQuantity: { ...valueQuantityTempF },
        referenceRange: [
          {
            low: { value: 97.7, unit: "F" },
          },
        ],
      });

      const normalized = normalizeObservations([observation]);
      expect(normalized.length).toBe(1);
      const result = normalized[0];
      expect(result).toBeTruthy();
      if (!result) throw new Error("Expected result to be defined");

      const rangeResult = result.referenceRange;
      expect(rangeResult).toBeTruthy();
      if (!rangeResult) throw new Error("Expected rangeResult to be defined");

      expect(rangeResult[0]?.low?.unit).toBe("F");
      expect(rangeResult[0]?.low?.value).toBe(97.7);
      expect(rangeResult[0]?.high).toBeUndefined();
    });

    it("handles reference ranges with only high value", () => {
      const observation = makeObservation({
        valueQuantity: { ...valueQuantityTempF },
        referenceRange: [
          {
            high: { value: 99.5, unit: "F" },
          },
        ],
      });

      const normalized = normalizeObservations([observation]);
      expect(normalized.length).toBe(1);
      const result = normalized[0];
      expect(result).toBeTruthy();
      if (!result) throw new Error("Expected result to be defined");

      const rangeResult = result.referenceRange;
      expect(rangeResult).toBeTruthy();
      if (!rangeResult) throw new Error("Expected rangeResult to be defined");

      expect(rangeResult[0]?.low).toBeUndefined();
      expect(rangeResult[0]?.high?.unit).toBe("F");
      expect(rangeResult[0]?.high?.value).toBe(99.5);
    });
  });
});
