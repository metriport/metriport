import {
  CodeableConcept,
  Observation,
  ObservationReferenceRange,
  Quantity,
} from "@medplum/fhirtypes";
import convert, { Unit } from "convert-units";
import { cloneDeep } from "lodash";

type UnitWithCode = {
  unit: Unit;
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
 *
 * Each key must be lowercase.
 */
const nonStandardUnitNormalizationMap = new Map<string, Unit>([
  ["cel", "C"],
  ["degf", "F"],
  ["[in_i]", "in"],
  ["[in_us]", "in"],
  ["[lb_av]", "lb"],
  ["[ft_us]", "ft"],
]);

/**
 * This map is used to convert standardized units to preferred units. i.e C -> F, lb -> g, in -> cm, etc.
 *
 * The reason to keep the mapping from X to X is to allow the mapping of both unit, and code (which are sometimes different).
 */
const unitConversionAndNormalizationMap = new Map<string, UnitWithCode>([
  ["C", { unit: "F", code: "degF" }], // https://hl7.org/fhir/R4/valueset-ucum-bodytemp.html
  ["F", { unit: "F", code: "degF" }], // https://hl7.org/fhir/R4/valueset-ucum-bodytemp.html
  ["kg", { unit: "kg", code: "kg" }], // https://hl7.org/fhir/R4/valueset-ucum-bodyweight.html
  ["g", { unit: "kg", code: "kg" }], // https://hl7.org/fhir/R4/valueset-ucum-bodyweight.html
  ["lb", { unit: "kg", code: "kg" }], // https://hl7.org/fhir/R4/valueset-ucum-bodyweight.html
  ["in", { unit: "cm", code: "cm" }], // https://hl7.org/fhir/R4/valueset-ucum-bodylength.html
  ["ft", { unit: "cm", code: "cm" }], // https://hl7.org/fhir/R4/valueset-ucum-bodylength.html
  ["cm", { unit: "cm", code: "cm" }], // https://hl7.org/fhir/R4/valueset-ucum-bodylength.html
]);

const blacklistedValues = ["see below", "see text", "see comments", "see note"];

const INTERPRETATION_CODE_LOW = "L";
const INTERPRETATION_CODE_NORMAL = "N";
const INTERPRETATION_CODE_HIGH = "H";
const INTERPRETATION_CODE_ABNORMAL = "A";

const interpretationTextMap = new Map<string, string>([
  [INTERPRETATION_CODE_LOW, "Low"],
  [INTERPRETATION_CODE_HIGH, "High"],
  [INTERPRETATION_CODE_NORMAL, "Normal"],
  [INTERPRETATION_CODE_ABNORMAL, "Abnormal"],
]);

const hl7ObservationInterpretationSystemUrl =
  "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation";

const highInterpretations = [INTERPRETATION_CODE_HIGH.toLowerCase(), "high", "critical"];
const lowInterpretations = [INTERPRETATION_CODE_LOW.toLowerCase(), "low"];
const normalInterpretations = [
  INTERPRETATION_CODE_NORMAL.toLowerCase(),
  "normal",
  "negative",
  "none seen",
  "not detected",
  "neg",
];
const abnormalInterpretations = [
  INTERPRETATION_CODE_ABNORMAL.toLowerCase(),
  "abnormal",
  "positive",
];

export function normalizeObservations(observations: Observation[]): Observation[] {
  return observations.map(obs => {
    const normalizedObs = cloneDeep(obs);

    if (normalizedObs.valueQuantity) {
      normalizedObs.valueQuantity = normalizeValueQuantity(normalizedObs.valueQuantity);
    }

    if (normalizedObs.referenceRange) {
      normalizedObs.referenceRange = normalizeReferenceRanges(
        normalizedObs.referenceRange,
        normalizedObs.valueQuantity?.unit
      );
    }
    const interpretation = buildObservationInterpretation(normalizedObs);
    if (interpretation) normalizedObs.interpretation = interpretation;

    return normalizedObs;
  });
}

function normalizeReferenceRanges(
  ranges: ObservationReferenceRange[],
  valueQuantityUnit?: string | undefined
): ObservationReferenceRange[] {
  return ranges.map(r => {
    const newRange = cloneDeep(r);
    if (newRange.low && !newRange.low.unit && valueQuantityUnit)
      newRange.low.unit = valueQuantityUnit;
    if (newRange.high && !newRange.high.unit && valueQuantityUnit)
      newRange.high.unit = valueQuantityUnit;

    return {
      ...newRange,
      ...(newRange.low ? { low: normalizeValueQuantity(newRange.low) } : undefined),
      ...(newRange.high ? { high: normalizeValueQuantity(newRange.high) } : undefined),
    };
  });
}

/**
 * Normalizes the units and converts the value accordingly.
 */
function normalizeValueQuantity(quantity: Quantity): Quantity {
  const normalizedQuantity = cloneDeep(quantity);

  if (!normalizedQuantity.unit) return normalizedQuantity;
  const unit = normalizeUnit(normalizedQuantity.unit);
  if (!unit) return normalizedQuantity;
  normalizedQuantity.unit = unit;

  const convertedUnit = unitConversionAndNormalizationMap.get(normalizedQuantity.unit);
  if (!convertedUnit) return normalizedQuantity;

  const value = normalizedQuantity.value;
  if (!value) return normalizedQuantity;

  const numericValue = typeof value === "string" ? parseFloat(value) : value;

  const convertedValue = convert(numericValue)
    .from(normalizedQuantity.unit as Unit)
    .to(convertedUnit.unit);

  if (!convertedValue) return normalizedQuantity;

  return {
    ...normalizedQuantity,
    value: parseFloat(convertedValue.toFixed(2)),
    ...convertedUnit,
  };
}

function normalizeUnit(unit: string): Unit | undefined {
  const trimmedUnit = unit.trim();

  return unitConversionAndNormalizationMap.has(trimmedUnit)
    ? (trimmedUnit as Unit)
    : unitConversionAndNormalizationMap.has(trimmedUnit.toLowerCase())
    ? (trimmedUnit.toLowerCase() as Unit)
    : unitConversionAndNormalizationMap.has(trimmedUnit.toUpperCase())
    ? (trimmedUnit.toUpperCase() as Unit)
    : nonStandardUnitNormalizationMap.get(trimmedUnit.toLowerCase());
}

export function buildObservationInterpretation(obs: Observation): CodeableConcept[] | undefined {
  const explicitInterpretation = getExplicitInterpretation(obs.interpretation);
  if (explicitInterpretation) {
    const normalizedExplicitCode = normalizeInterpretationStringToCode(explicitInterpretation);
    return buildInterpretationFromCode(normalizedExplicitCode);
  }

  const value = getValueFromObservation(obs);
  if (!value) return undefined;

  if (typeof value === "string") {
    const normalizedValueCode = normalizeInterpretationStringToCode(value);
    return buildInterpretationFromCode(normalizedValueCode);
  }

  const firstReference = obs.referenceRange?.[0];
  const referenceRange: ReferenceRange = {
    low: firstReference?.low?.value,
    high: firstReference?.high?.value,
    unit: firstReference?.low?.unit?.toString() ?? firstReference?.high?.unit?.toString(),
    text: firstReference?.text?.toLowerCase().trim(),
  };

  const interpretationCode = calculateInterpretationCode(value, referenceRange);
  return buildInterpretationFromCode(interpretationCode);
}

function getValueFromObservation(obs: Observation): string | number | undefined {
  if (obs.valueQuantity) {
    return obs.valueQuantity.value;
  } else if (obs.valueCodeableConcept?.text) {
    return parseValueFromString(obs.valueCodeableConcept.text);
  } else if (obs.valueString) {
    return parseValueFromString(obs.valueString);
  }

  return undefined;
}

function parseValueFromString(textValue: string): number | string | undefined {
  const parsedNumber = parseFloat(textValue);
  const value = isNaN(parsedNumber) ? textValue : parsedNumber;
  if (blacklistedValues.includes(value?.toString().toLowerCase().trim())) return undefined;
  return value;
}

export function getExplicitInterpretation(
  interpretations: CodeableConcept[] | undefined
): string | undefined {
  if (!interpretations || !interpretations[0]) return undefined;
  // Ok to just get the first intepretation, as this has never been observed to have more than 1 element
  const primaryInterpretation = interpretations[0];

  const primaryText = primaryInterpretation.text;
  const interpretationText = primaryText === "unknown" ? undefined : primaryText;

  return (
    interpretationText ??
    primaryInterpretation.coding?.[0]?.display ??
    primaryInterpretation.coding?.[0]?.code
  );
}

export function calculateInterpretationCode(
  value: number,
  referenceRange: ReferenceRange | undefined
): string | undefined {
  if (referenceRange) {
    const low = referenceRange.low;
    const high = referenceRange.high;

    if (low == undefined && high == undefined) {
      return undefined;
    } else if (low != undefined && high != undefined) {
      if (value < low) {
        return INTERPRETATION_CODE_LOW;
      } else if (value > high) {
        return INTERPRETATION_CODE_HIGH;
      }
    } else if (low != undefined && value < low) {
      return INTERPRETATION_CODE_LOW;
    } else if (high != undefined && value > high) {
      return INTERPRETATION_CODE_HIGH;
    }
    return INTERPRETATION_CODE_NORMAL;
  }

  return undefined;
}

function buildInterpretationFromCode(
  interpretationCode: string | undefined
): CodeableConcept[] | undefined {
  if (!interpretationCode) return undefined;
  const interpretationText = interpretationTextMap.get(interpretationCode);
  return [
    {
      ...(interpretationText ? { text: interpretationText } : undefined),
      coding: [
        {
          code: interpretationCode,
          system: hl7ObservationInterpretationSystemUrl,
        },
      ],
    },
  ];
}

export function normalizeInterpretationStringToCode(interpretation: string): string | undefined {
  const normalized = interpretation.toLowerCase().trim();

  if (highInterpretations.includes(normalized)) return INTERPRETATION_CODE_HIGH;
  if (lowInterpretations.includes(normalized)) return INTERPRETATION_CODE_LOW;
  if (normalInterpretations.includes(normalized)) return INTERPRETATION_CODE_NORMAL;
  if (abnormalInterpretations.includes(normalized)) return INTERPRETATION_CODE_ABNORMAL;

  return undefined;
}
