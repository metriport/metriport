import {
  CodeableConcept,
  Observation,
  ObservationReferenceRange,
  Quantity,
} from "@medplum/fhirtypes";
import convert, { Unit } from "convert-units";

type UnitComplex = {
  unit: string;
  code?: string;
};

type ReferenceRange = {
  low: number | undefined;
  high: number | undefined;
  unit: string | undefined;
  text?: string | undefined;
};

/**
 * This map is used to normalize unconventional unit names to standard unit names. i.e cel -> C, millimeter to m, etc.
 */
const unitNormalizationMap = new Map<string, string>([
  ["cel", "C"],
  ["degf", "F"],
  ["in_i", "in"],
]);

/**
 * This map is used to convert standariozed units to preferred units. i.e C -> F, lb -> g, in -> cm, etc.
 */
const unitConversionMap = new Map<string, UnitComplex>([
  ["C", { unit: "F", code: "degF" }], // https://hl7.org/fhir/R4/valueset-ucum-bodytemp.html
  ["F", { unit: "F", code: "degF" }], // https://hl7.org/fhir/R4/valueset-ucum-bodytemp.html
  ["kg", { unit: "g" }], // https://hl7.org/fhir/R4/valueset-ucum-bodyweight.html
  ["lb", { unit: "g" }], // https://hl7.org/fhir/R4/valueset-ucum-bodyweight.html
  ["in", { unit: "cm" }], // https://hl7.org/fhir/R4/valueset-ucum-bodylength.html
]);

const blacklistedValues = ["see below", "see text", "see comments", "see note"];

const INTERPRETATION_LOW = "L";
const INTERPRETATION_NORMAL = "N";
const INTERPRETATION_HIGH = "H";
const INTERPRETATION_ABNORMAL = "A";

const interpretationMap = new Map<string, string>([
  [INTERPRETATION_LOW, "Low"],
  [INTERPRETATION_HIGH, "High"],
  [INTERPRETATION_NORMAL, "Normal"],
  [INTERPRETATION_ABNORMAL, "Abnormal"],
]);

const hl7ObservationInterpretationSystem =
  "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation";

const highInterpretations = ["high", "critical"];
const lowInterpretations = ["low"];
const normalInterpretations = ["normal", "negative", "none seen", "not detected", "neg"];
const abnormalInterpretations = ["abnormal", "positive"];

export function normalizeObservations(observations: Observation[]): Observation[] {
  observations.map(obs => {
    if (obs.valueQuantity) {
      const initialValueUnit = processValueQuantity(obs.valueQuantity);

      if (obs.referenceRange) {
        processReferenceRanges(obs.referenceRange, initialValueUnit);
      }
    }
    const interpretation = buildObservationInterpretation(obs);
    if (interpretation) obs.interpretation = interpretation;
  });

  return observations;
}

function processValueQuantity(valueQuantity: Quantity): string | undefined {
  const result = getConvertedValueAndUnit(valueQuantity);
  const initialUnit = valueQuantity.unit;
  if (!result) return initialUnit;

  const { newValue, newUnit, code } = result;

  valueQuantity.value = newValue;
  valueQuantity.unit = newUnit;
  if (code) valueQuantity.code = code;

  return initialUnit;
}

function processReferenceRanges(
  ranges: ObservationReferenceRange[],
  initialValueUnit?: string | undefined
): void {
  ranges?.forEach(r => {
    if (r.low) {
      if (!r.low.unit && initialValueUnit) r.low.unit = initialValueUnit;
      const newLow = convertRangeValue(r.low);
      if (newLow) r.low = newLow;
    }
    if (r.high) {
      if (!r.high.unit && initialValueUnit) r.high.unit = initialValueUnit;
      const newHigh = convertRangeValue(r.high);
      if (newHigh) r.high = newHigh;
    }
  });
}

function convertRangeValue(quantity: Quantity | undefined): Quantity | undefined {
  if (!quantity) return;

  const result = getConvertedValueAndUnit(quantity);
  if (!result) return;

  const { newValue, newUnit, code } = result;

  quantity.value = newValue;
  quantity.unit = newUnit;
  if (code) quantity.code = code;

  return quantity;
}

function getConvertedValueAndUnit(quantity: Quantity):
  | {
      newValue: number;
      newUnit: string;
      code?: string | undefined;
    }
  | undefined {
  const value = quantity.value;
  if (!value) return;

  const unit = normalizeUnit(quantity.unit);
  if (!unit) return;

  const convertedUnit = unitConversionMap.get(unit);
  if (!convertedUnit) return;

  const convertedValue = convert(value)
    .from(unit as Unit)
    .to(convertedUnit.unit as Unit);

  if (!convertedValue) return;

  return {
    newValue: parseFloat(convertedValue.toFixed(2)),
    newUnit: convertedUnit.unit,
    code: convertedUnit.code,
  };
}

function normalizeUnit(unit?: string): string | undefined {
  if (!unit) return;

  const trimmedUnit = unit.trim();
  return unitConversionMap.has(trimmedUnit)
    ? trimmedUnit
    : unitConversionMap.has(trimmedUnit.toLowerCase())
    ? trimmedUnit.toLowerCase()
    : unitConversionMap.has(trimmedUnit.toUpperCase())
    ? trimmedUnit.toUpperCase()
    : unitNormalizationMap.get(trimmedUnit.toLowerCase());
}

export function buildObservationInterpretation(obs: Observation): CodeableConcept[] | undefined {
  const firstReference = obs.referenceRange?.[0];

  const referenceRange: ReferenceRange = {
    low: firstReference?.low?.value,
    high: firstReference?.high?.value,
    unit: firstReference?.low?.unit?.toString() ?? firstReference?.high?.unit?.toString(),
    text: firstReference?.text?.toLowerCase().trim(),
  };

  const value = getValueFromObservation(obs);

  const explicitInterpretation = getExplicitInterpretation(obs);
  const interpretationString = calculateInterpretationCode(
    explicitInterpretation,
    value,
    referenceRange
  );
  console.log("interpretationString IS", interpretationString);
  return buildInterpretationFromString(interpretationString);
}

function getValueFromObservation(obs: Observation): string | number | undefined {
  let value: number | string | undefined;
  if (obs.valueQuantity) {
    value = obs.valueQuantity.value;
  } else if (obs.valueCodeableConcept) {
    value = obs.valueCodeableConcept.text;
  } else if (obs.valueString) {
    const parsedNumber = parseFloat(obs.valueString);
    value = isNaN(parsedNumber) ? obs.valueString : parsedNumber;
    if (blacklistedValues.includes(value?.toString().toLowerCase().trim())) value = undefined;
  }

  return value;
}

export function getExplicitInterpretation(obs: Observation): string | undefined {
  const interpretationText =
    obs.interpretation?.[0]?.text === "unknown" ? undefined : obs.interpretation?.[0]?.text;

  return (
    interpretationText ??
    obs.interpretation?.[0]?.coding?.[0]?.display ??
    obs.interpretation?.[0]?.coding?.[0]?.code
  );
}

export function calculateInterpretationCode(
  explicitInterpretation: string | undefined,
  value: number | string | undefined,
  referenceRange: ReferenceRange | undefined
): string | undefined {
  if (explicitInterpretation) return normalizeInterpretationStringToCode(explicitInterpretation);

  if (typeof value === "number" && referenceRange) {
    const low = referenceRange.low;
    const high = referenceRange.high;

    console.log(low, high, "and value", value);
    if (low != undefined && high != undefined) {
      if (value >= low && value <= high) {
        return INTERPRETATION_NORMAL;
      } else if (value < low) {
        return INTERPRETATION_LOW;
      } else if (value > high) {
        return INTERPRETATION_HIGH;
      }
    } else if (low != undefined) {
      if (value < low) {
        return INTERPRETATION_LOW;
      } else {
        return INTERPRETATION_NORMAL;
      }
    } else if (high != undefined) {
      if (value > high) {
        return INTERPRETATION_HIGH;
      } else {
        return INTERPRETATION_NORMAL;
      }
    }
  } else if (typeof value === "string") {
    return normalizeInterpretationStringToCode(value);
  }

  return undefined;
}

function buildInterpretationFromString(
  interpretation: string | undefined
): CodeableConcept[] | undefined {
  if (!interpretation) return undefined;
  const interpretationText = interpretationMap.get(interpretation);
  return [
    {
      ...(interpretationText ? { text: interpretationText } : undefined),
      coding: [
        {
          code: interpretation,
          system: hl7ObservationInterpretationSystem,
        },
      ],
    },
  ];
}

export function normalizeInterpretationStringToCode(interpretation: string): string {
  const normalized = interpretation.toLowerCase().trim();

  if (highInterpretations.includes(normalized)) return INTERPRETATION_HIGH;
  if (lowInterpretations.includes(normalized)) return INTERPRETATION_LOW;
  if (normalInterpretations.includes(normalized)) return INTERPRETATION_NORMAL;
  if (abnormalInterpretations.includes(normalized)) return INTERPRETATION_ABNORMAL;

  return interpretation;
}
