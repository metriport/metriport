import { Observation, Quantity, ObservationReferenceRange } from "@medplum/fhirtypes";
import convert, { Unit } from "convert-units";

type UnitComplex = {
  unit: string;
  code?: string;
};
/**
 * This map is used to normalize unconventional unit names to standard unit names. i.e cel -> C, millimeter to m, etc.
 */
const unitNormalizationMap = new Map<string, string>([
  ["cel", "C"],
  ["degf", "F"],
]);

/**
 * This map is used to convert standard units to preferred units. i.e C -> F, g -> kg, etc.
 */
const unitConversionMap = new Map<string, UnitComplex>([
  ["C", { unit: "F", code: "degF" }],
  ["F", { unit: "F", code: "degF" }],
  ["g", { unit: "lb" }],
  ["kg", { unit: "lb" }],
  ["m", { unit: "in" }],
  ["cm", { unit: "in" }],
]);

export function normalizeObservations(observations: Observation[]): Observation[] {
  observations.map(o => {
    if (o.valueQuantity) {
      const initialValueUnit = processValueQuantity(o.valueQuantity);

      if (o.referenceRange) {
        processReferenceRanges(o.referenceRange, initialValueUnit);
      }
    }
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
