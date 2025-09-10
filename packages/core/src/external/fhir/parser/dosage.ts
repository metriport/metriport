import { DosageDoseAndRate } from "@medplum/fhirtypes";
import { parseQuantity } from "./quantity-unit";
import { parseRatio } from "./ratio";

export function parseDosage(inputString: string): DosageDoseAndRate | undefined {
  // Parse a dosage that is expressed as a ratio
  const ratio = parseRatio(inputString);
  if (ratio && ratio.numerator && ratio.denominator) {
    return {
      doseQuantity: ratio.numerator,
      rateQuantity: ratio.denominator,
    };
  }

  // Parse a dosage that is expressed as a quantity
  const numerator = parseQuantity(inputString);
  if (!numerator) return undefined;

  return {
    doseQuantity: numerator.quantity,
  };
}
