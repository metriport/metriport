import { Quantity } from "@medplum/fhirtypes";
import { parseNumber } from "./number";
import { getValidUcumCode, createUcumQuantity } from "./ucum-unit";
import { getFirstToken } from "./shared";

export function parseQuantity(
  inputString: string
): { quantity: Quantity; remainder: string } | undefined {
  const parsedValue = parseNumber(inputString);
  if (!parsedValue) return undefined;

  const [unit, remainder] = getFirstToken(parsedValue.remainder.trim());
  const validUcumUnit = getValidUcumCode(unit);
  if (!validUcumUnit) return undefined;

  const quantity = createUcumQuantity(parsedValue.value, validUcumUnit);

  return {
    quantity,
    remainder,
  };
}
