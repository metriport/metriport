import { DosageDoseAndRate } from "@medplum/fhirtypes";
import { parseQuantity } from "./quantity-unit";
import { parseRatio } from "./ratio";
import { buildParserExtension } from "./extension";

export function parseDosage(inputString: string): DosageDoseAndRate | undefined {
  // Parse a dosage that is expressed as a ratio
  const ratio = parseRatio(inputString);
  if (ratio && ratio.numerator && ratio.denominator) {
    return {
      extension: [buildParserExtension(inputString)],
      doseQuantity: ratio.numerator,
      rateQuantity: ratio.denominator,
    };
  }

  // Parse a dosage that is expressed as a quantity
  const numerator = parseQuantity(inputString);
  if (!numerator) return undefined;

  return {
    extension: [buildParserExtension(inputString)],
    doseQuantity: numerator.quantity,
  };
}
