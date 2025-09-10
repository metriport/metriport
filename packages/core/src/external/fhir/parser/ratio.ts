import { Ratio } from "@medplum/fhirtypes";
import { UNIT_OF_MEASURE_URL } from "@metriport/shared/medical";
import { parseNumber } from "./number";

export function parseRatio(inputString: string): Ratio | undefined {
  const [numeratorString, , denominatorString] = inputString.split(/(\s*\/\s*|\s+per\s+)/);
  if (!numeratorString || !denominatorString) {
    return parseNumericQuantityAsRatio(inputString);
  }

  const numerator = parseNumber(numeratorString);
  const denominator = parseNumber(denominatorString);

  if (!numerator || !denominator) return undefined;

  const numeratorUnit = numerator.remainder.trim();
  const denominatorUnit = denominator.remainder.trim();

  return {
    numerator: {
      value: numerator.value,
      unit: numeratorUnit,
      system: UNIT_OF_MEASURE_URL,
      code: numeratorUnit,
    },
    denominator: {
      value: denominator.value,
      unit: denominatorUnit,
      system: UNIT_OF_MEASURE_URL,
      code: denominatorUnit,
    },
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
