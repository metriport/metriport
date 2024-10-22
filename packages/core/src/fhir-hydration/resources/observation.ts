import { Observation, Quantity } from "@medplum/fhirtypes";
import convert, { Unit } from "convert-units";

/**
 * This map is used to normalize unconventional unit names to standard unit names. i.e cel -> C, millimeter to m, etc.
 */
const unitNormalizationMap = new Map<string, string>([["cel", "C"]]);

/**
 * This map is used to convert standard units to preferred units. i.e C -> F, g -> kg, etc.
 */
const unitConversionMap = new Map<string, string>([
  ["C", "F"],
  ["g", "kg"],
  ["lb", "kg"],
  ["m", "cm"],
]);

export function hydrateObservations(observations: Observation[]): Observation[] {
  observations.map(o => {
    if (o.valueQuantity) {
      const result = getConvertedValueAndUnit(o.valueQuantity);
      if (!result) return;

      const { newValue, newUnit } = result;

      o.valueQuantity.value = newValue;
      o.valueQuantity.unit = newUnit;
    }

    const ranges = o.referenceRange;
    ranges?.map(r => {
      if (r.low) {
        const result = getConvertedValueAndUnit(r.low);
        if (!result) return;

        const { newValue, newUnit } = result;

        r.low.value = newValue;
        r.low.unit = newUnit;
      }
      if (r.high) {
        const result = getConvertedValueAndUnit(r.high);
        if (!result) return;

        const { newValue, newUnit } = result;

        r.high.value = newValue;
        r.high.unit = newUnit;
      }
    });
  });

  return observations;
}

function getConvertedValueAndUnit(quantity: Quantity):
  | {
      newValue: number;
      newUnit: string;
    }
  | undefined {
  const value = quantity.value;
  if (!value) return;

  const unit = quantity.unit?.trim();
  if (!unit) return;

  const normalizedUnit = unitConversionMap.has(unit)
    ? unit
    : unitConversionMap.has(unit.toLowerCase())
    ? unit.toLowerCase()
    : unitConversionMap.has(unit.toUpperCase())
    ? unit.toUpperCase()
    : unitNormalizationMap.get(unit);
  if (!normalizedUnit) return;

  const convertedUnit = unitConversionMap.get(normalizedUnit);
  if (!convertedUnit) return;

  const convertedValue = convert(value)
    .from(normalizedUnit as Unit)
    .to(convertedUnit as Unit);

  if (!convertedValue) return;

  return {
    newValue: convertedValue,
    newUnit: convertedUnit,
  };
}
