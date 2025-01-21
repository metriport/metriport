import {
  CodeableConcept,
  Observation,
  ObservationReferenceRange,
  Quantity,
} from "@medplum/fhirtypes";
import convert, { Unit } from "convert-units";
import { cloneDeep } from "lodash";

type UnitWithCode = {
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
 * This map is used to normalize unconventional unit names to standard unit names. i.e cel -> C, etc.
 */
const unitNormalizationMap = new Map<string, string>([
  ["cel", "C"],
  ["degf", "F"],
  ["in_i", "in"],
]);

/**
 * This map is used to convert standardized units to preferred units. i.e C -> F, lb -> g, in -> cm, etc.
 */
const unitConversionAndNormalization = new Map<string, UnitWithCode>([
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

const hl7ObservationInterpretationSystemUrl =
  "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation";

const highInterpretations = ["high", "critical"];
const lowInterpretations = ["low"];
const normalInterpretations = ["normal", "negative", "none seen", "not detected", "neg"];
const abnormalInterpretations = ["abnormal", "positive"];

export function normalizeObservations(observations: Observation[]): Observation[] {
  return observations.map(obs => {
    const normalizedObs = cloneDeep(obs);

    if (normalizedObs.valueQuantity) {
      normalizedObs.valueQuantity = normalizeValueQuantity(normalizedObs.valueQuantity);

      if (normalizedObs.referenceRange) {
        normalizedObs.referenceRange = normalizeReferenceRanges(
          normalizedObs.referenceRange,
          normalizedObs.valueQuantity.unit
        );
      }
    }
    const interpretation = buildObservationInterpretation(normalizedObs);
    if (interpretation) normalizedObs.interpretation = interpretation;

    return normalizedObs;
  });
}

function normalizeReferenceRanges(
  ranges: ObservationReferenceRange[],
  initialValueUnit?: string | undefined
): ObservationReferenceRange[] {
  return ranges.map(r => {
    const newRange = cloneDeep(r);

    if (r.low) {
      if (!r.low.unit && initialValueUnit) r.low.unit = initialValueUnit;
      const newLow = normalizeValueQuantity(r.low);
      if (newLow) newRange.low = newLow;
    }

    if (r.high) {
      if (!r.high.unit && initialValueUnit) r.high.unit = initialValueUnit;
      const newHigh = normalizeValueQuantity(r.high);
      if (newHigh) newRange.high = newHigh;
    }

    return newRange;
  });
}

/**
 * Normalizes the units and converts the value accordingly.
 */
function normalizeValueQuantity(quantity: Quantity): Quantity {
  const value = quantity.value;
  if (value == undefined) return quantity;

  const unit = normalizeUnit(quantity.unit);
  if (!unit) return quantity;

  const convertedUnit = unitConversionAndNormalization.get(unit);
  if (!convertedUnit) return quantity;

  const convertedValue = convert(value)
    .from(unit as Unit)
    .to(convertedUnit.unit as Unit);

  if (!convertedValue) return quantity;

  return {
    ...quantity,
    value: parseFloat(convertedValue.toFixed(2)),
    unit: convertedUnit.unit,
    ...(convertedUnit.code ? { code: convertedUnit.code } : undefined),
  };
}

function normalizeUnit(unit?: string): string | undefined {
  if (!unit) return;

  const trimmedUnit = unit.trim();
  return unitConversionAndNormalization.has(trimmedUnit)
    ? trimmedUnit
    : unitConversionAndNormalization.has(trimmedUnit.toLowerCase())
    ? trimmedUnit.toLowerCase()
    : unitConversionAndNormalization.has(trimmedUnit.toUpperCase())
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
          system: hl7ObservationInterpretationSystemUrl,
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
