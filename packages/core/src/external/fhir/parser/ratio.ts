import { Ratio } from "@medplum/fhirtypes";
import { parseQuantity } from "./quantity-unit";
import { getFirstToken } from "./shared";
import { parseUcumUnit, createUcumQuantity } from "./ucum-unit";

const DIVIDERS = new Set<string>(["/", "per"]);

export function parseRatio(inputString: string): Ratio | undefined {
  const numerator = parseQuantity(inputString);
  if (!numerator) return undefined;

  const [divider, remainder] = getFirstToken(numerator.remainder);
  if (DIVIDERS.has(divider)) {
    let denominator = parseQuantity(remainder);
    if (!denominator) {
      const ucumUnit = parseUcumUnit(remainder);
      if (!ucumUnit || !ucumUnit.code) return undefined;
      denominator = {
        quantity: createUcumQuantity(1, ucumUnit.code),
        remainder: ucumUnit.remainder,
      };
    }

    return {
      numerator: numerator.quantity,
      denominator: denominator.quantity,
    };
  }

  return {
    numerator: numerator.quantity,
  };
}
