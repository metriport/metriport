import { Quantity } from "@medplum/fhirtypes";
import { UNIT_OF_MEASURE_URL } from "@metriport/shared/medical";
import { parseNumber } from "./number";
import { getValidUcumCode } from "./ucum-unit";
import { getFirstToken } from "./shared";

export function parseQuantity(
  inputString: string
): { quantity: Quantity; remainder: string } | undefined {
  const quantity = parseNumber(inputString);
  if (!quantity) return undefined;

  const [unit, remainder] = getFirstToken(quantity.remainder.trim());
  const validUcumUnit = getValidUcumCode(unit);
  if (!validUcumUnit) return undefined;

  return {
    quantity: {
      value: quantity.value,
      unit,
      system: UNIT_OF_MEASURE_URL,
      code: unit,
    },
    remainder,
  };
}
