import {
  CodeableConcept,
  Observation,
  ObservationReferenceRange,
  Quantity,
} from "@medplum/fhirtypes";
import { isLoincCoding } from "@metriport/shared/medical";
import convert, { Unit } from "convert-units";
import { cloneDeep } from "lodash";
import { out } from "../../../../util";
import {
  a1cUnitNormalizationMap,
  bmiPercentileUnitNormalizationMap,
  bmiUnitNormalizationMap,
  efUnitNormalizationMap,
  gfrUnitNormalizationMap,
  glucoseUnitNormalizationMap,
} from "./unit-maps";

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

const loincCodeToTargetCallbackFnMap = new Map<string, (unit: string) => string>([
  // GFR
  ["33914-3", (unit: string) => getStandardObservationUnit(unit, gfrUnitNormalizationMap)],
  ["48642-3", (unit: string) => getStandardObservationUnit(unit, gfrUnitNormalizationMap)],
  ["48643-1", (unit: string) => getStandardObservationUnit(unit, gfrUnitNormalizationMap)],
  ["50044-7", (unit: string) => getStandardObservationUnit(unit, gfrUnitNormalizationMap)],
  ["50210-4", (unit: string) => getStandardObservationUnit(unit, gfrUnitNormalizationMap)],
  ["50384-7", (unit: string) => getStandardObservationUnit(unit, gfrUnitNormalizationMap)],
  ["62238-1", (unit: string) => getStandardObservationUnit(unit, gfrUnitNormalizationMap)],
  ["69405-9", (unit: string) => getStandardObservationUnit(unit, gfrUnitNormalizationMap)],
  ["70969-1", (unit: string) => getStandardObservationUnit(unit, gfrUnitNormalizationMap)],
  ["77147-7", (unit: string) => getStandardObservationUnit(unit, gfrUnitNormalizationMap)],
  ["88293-6", (unit: string) => getStandardObservationUnit(unit, gfrUnitNormalizationMap)],
  ["88294-4", (unit: string) => getStandardObservationUnit(unit, gfrUnitNormalizationMap)],
  ["94677-2", (unit: string) => getStandardObservationUnit(unit, gfrUnitNormalizationMap)],
  ["98979-8", (unit: string) => getStandardObservationUnit(unit, gfrUnitNormalizationMap)],
  ["98980-6", (unit: string) => getStandardObservationUnit(unit, gfrUnitNormalizationMap)],
  ["102097-3", (unit: string) => getStandardObservationUnit(unit, gfrUnitNormalizationMap)],
  // A1c
  ["4548-4", (unit: string) => getStandardObservationUnit(unit, a1cUnitNormalizationMap)],
  ["4549-2", (unit: string) => getStandardObservationUnit(unit, a1cUnitNormalizationMap)],
  ["17855-8", (unit: string) => getStandardObservationUnit(unit, a1cUnitNormalizationMap)],
  ["17856-6", (unit: string) => getStandardObservationUnit(unit, a1cUnitNormalizationMap)],
  ["59261-8", (unit: string) => getStandardObservationUnit(unit, a1cUnitNormalizationMap)],
  ["62388-4", (unit: string) => getStandardObservationUnit(unit, a1cUnitNormalizationMap)],
  ["71875-9", (unit: string) => getStandardObservationUnit(unit, a1cUnitNormalizationMap)],
  // BMI
  ["39156-5", (unit: string) => getStandardObservationUnit(unit, bmiUnitNormalizationMap)],
  ["59574-4", (unit: string) => getStandardObservationUnit(unit, bmiUnitNormalizationMap)],
  ["59575-1", (unit: string) => getStandardObservationUnit(unit, bmiUnitNormalizationMap)],
  // BMI Percentile
  [
    "59576-9",
    (unit: string) => getStandardObservationUnit(unit, bmiPercentileUnitNormalizationMap),
  ],
  // Glucose in Serum
  ["2345-7", (unit: string) => getStandardObservationUnit(unit, glucoseUnitNormalizationMap)],
  ["74774-1", (unit: string) => getStandardObservationUnit(unit, glucoseUnitNormalizationMap)],
  ["1558-6", (unit: string) => getStandardObservationUnit(unit, glucoseUnitNormalizationMap)],
  ["12651-6", (unit: string) => getStandardObservationUnit(unit, glucoseUnitNormalizationMap)],
  ["10449-7", (unit: string) => getStandardObservationUnit(unit, glucoseUnitNormalizationMap)],
  ["17865-7", (unit: string) => getStandardObservationUnit(unit, glucoseUnitNormalizationMap)],
  ["1504-0", (unit: string) => getStandardObservationUnit(unit, glucoseUnitNormalizationMap)],
  ["1507-3", (unit: string) => getStandardObservationUnit(unit, glucoseUnitNormalizationMap)],
  ["1518-0", (unit: string) => getStandardObservationUnit(unit, glucoseUnitNormalizationMap)],
  ["1547-9", (unit: string) => getStandardObservationUnit(unit, glucoseUnitNormalizationMap)],
  ["12646-6", (unit: string) => getStandardObservationUnit(unit, glucoseUnitNormalizationMap)],
  // Glucose in Blood
  ["2339-0", (unit: string) => getStandardObservationUnit(unit, glucoseUnitNormalizationMap)],
  ["2340-8", (unit: string) => getStandardObservationUnit(unit, glucoseUnitNormalizationMap)],
  ["2341-6", (unit: string) => getStandardObservationUnit(unit, glucoseUnitNormalizationMap)],
  // Glucose in Urine - Much more prevalent to have valueString, with variations of Neg/Negative/NEGATIVE, etc.
  // ["5792-7", (unit: string) => getStandardObservationUnit(unit, glucoseUnitNormalizationMap)],
  // ["53328-1", (unit: string) => getStandardObservationUnit(unit, glucoseUnitNormalizationMap)],
  // ["2350-7", (unit: string) => getStandardObservationUnit(unit, glucoseUnitNormalizationMap)],
  // Ejection Fraction
  ["10230-1", (unit: string) => getStandardObservationUnit(unit, efUnitNormalizationMap)],
  ["8807-0", (unit: string) => getStandardObservationUnit(unit, efUnitNormalizationMap)],
  ["79991-6", (unit: string) => getStandardObservationUnit(unit, efUnitNormalizationMap)],
  ["39913-9", (unit: string) => getStandardObservationUnit(unit, efUnitNormalizationMap)],
  ["18047-1", (unit: string) => getStandardObservationUnit(unit, efUnitNormalizationMap)],
  ["104251-4", (unit: string) => getStandardObservationUnit(unit, efUnitNormalizationMap)],
  ["104253-0", (unit: string) => getStandardObservationUnit(unit, efUnitNormalizationMap)],
]);

function getStandardObservationUnit(unit: string, map: Map<string, string>): string {
  const normalized = unit?.trim()?.toLowerCase().replace(/ /g, "");
  const standardUnit = map.get(normalized);
  if (!standardUnit) {
    const { log } = out("getStandardObservationUnit");
    const msg = `Detected unmapped Observation unit`;
    const details = {
      unit,
      normalized,
      map: Array.from(map.entries()),
    };
    log(`${msg}. Cause: ${JSON.stringify(details)}`);
    return unit?.trim();
  }
  return standardUnit;
}
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
    const loincCode = normalizedObs.code?.coding?.find(isLoincCoding);

    if (normalizedObs.valueQuantity) {
      normalizedObs.valueQuantity = normalizeValueQuantity(
        normalizedObs.valueQuantity,
        loincCode?.code
      );
    }

    if (normalizedObs.referenceRange) {
      normalizedObs.referenceRange = normalizeReferenceRanges(
        normalizedObs.referenceRange,
        normalizedObs.valueQuantity?.unit,
        loincCode?.code
      );
    }
    const interpretation = buildObservationInterpretation(normalizedObs);
    if (interpretation) normalizedObs.interpretation = interpretation;

    return normalizedObs;
  });
}

function normalizeReferenceRanges(
  ranges: ObservationReferenceRange[],
  valueQuantityUnit?: string | undefined,
  loincCode?: string | undefined
): ObservationReferenceRange[] {
  return ranges.map(r => {
    const newRange = cloneDeep(r);
    if (newRange.low && !newRange.low.unit && valueQuantityUnit)
      newRange.low.unit = valueQuantityUnit;
    if (newRange.high && !newRange.high.unit && valueQuantityUnit)
      newRange.high.unit = valueQuantityUnit;

    return {
      ...newRange,
      ...(newRange.low ? { low: normalizeValueQuantity(newRange.low, loincCode) } : undefined),
      ...(newRange.high ? { high: normalizeValueQuantity(newRange.high, loincCode) } : undefined),
    };
  });
}

/**
 * Normalizes the units and converts the value accordingly.
 */
function normalizeValueQuantity(quantity: Quantity, loincCode?: string): Quantity {
  const normalizedQuantity = cloneDeep(quantity);

  if (!normalizedQuantity.unit) return normalizedQuantity;
  const unit = normalizeUnit(normalizedQuantity.unit, loincCode);
  if (!unit) return normalizedQuantity;
  if (unit.isConvertibleUnit) {
    normalizedQuantity.unit = unit.unit as Unit;
  } else {
    normalizedQuantity.unit = unit.unit as string;
    return normalizedQuantity;
  }

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

function getStandardUnitFromLoincCode(unit: string, loincCode?: string): string | undefined {
  if (!loincCode) return undefined;
  const targetUnitFn = loincCodeToTargetCallbackFnMap.get(loincCode);
  if (!targetUnitFn) return undefined;

  return targetUnitFn(unit);
}

function normalizeUnit(
  unit: string,
  loincCode?: string
):
  | { isConvertibleUnit: false; unit: string | undefined }
  | { isConvertibleUnit: true; unit: Unit | string }
  | undefined {
  if (!unit || typeof unit !== "string") return undefined;
  const trimmedUnit = unit.trim();
  const standardUnit = getStandardUnitFromLoincCode(unit, loincCode);
  if (standardUnit) return { isConvertibleUnit: false, unit: standardUnit };

  return unitConversionAndNormalizationMap.has(trimmedUnit)
    ? { isConvertibleUnit: true, unit: trimmedUnit as Unit }
    : unitConversionAndNormalizationMap.has(trimmedUnit.toLowerCase())
    ? { isConvertibleUnit: true, unit: trimmedUnit.toLowerCase() as Unit }
    : unitConversionAndNormalizationMap.has(trimmedUnit.toUpperCase())
    ? { isConvertibleUnit: true, unit: trimmedUnit.toUpperCase() as Unit }
    : nonStandardUnitNormalizationMap.get(trimmedUnit.toLowerCase())
    ? {
        isConvertibleUnit: true,
        unit: nonStandardUnitNormalizationMap.get(trimmedUnit.toLowerCase()) as Unit,
      }
    : undefined;
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
