import { Quantity } from "@medplum/fhirtypes";
import { UNIT_OF_MEASURE_URL } from "@metriport/shared/medical";
import { parseNumber } from "./number";
import { parseUcumUnit } from "./ucum-unit";

export function parseQuantity(inputString: string): Quantity | undefined {
  const quantity = parseNumber(inputString);
  if (!quantity) return undefined;

  const unit = parseUcumUnit(quantity.remainder.trim());
  if (!unit) return undefined;

  return {
    value: quantity.value,
    unit,
    system: UNIT_OF_MEASURE_URL,
    code: quantity.remainder.trim(),
  };
}
