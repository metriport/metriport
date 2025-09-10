import { Ratio } from "@medplum/fhirtypes";
import { UNIT_OF_MEASURE_URL } from "@metriport/shared/medical";
import { parseNumber } from "./number";
import { parseQuantity } from "./quantity-unit";
import { getFirstToken } from "./shared";
import { parseUcumUnit } from "./ucum-unit";

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
        quantity: {
          value: 1,
          unit: ucumUnit.code,
          system: UNIT_OF_MEASURE_URL,
          code: ucumUnit.code,
        },
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

export function parseNumericQuantityAsRatio(inputString: string): Ratio | undefined {
  const amount = parseNumber(inputString);
  if (!amount) return undefined;

  return {
    numerator: {
      value: amount.value,
      unit: amount.remainder.trim(),
      system: UNIT_OF_MEASURE_URL,
      code: amount.remainder.trim(),
    },
    denominator: {
      value: 1,
      unit: "1",
      system: UNIT_OF_MEASURE_URL,
      code: "1",
    },
  };
}
