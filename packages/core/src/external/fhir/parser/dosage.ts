import { DosageDoseAndRate } from "@medplum/fhirtypes";
import { parseQuantity } from "./quantity-unit";

export function parseDosage(inputString: string): DosageDoseAndRate | undefined {
  const numerator = parseQuantity(inputString);
  if (!numerator) return undefined;

  const denominator = parseQuantity(numerator.remainder);

  if (denominator) {
    return {
      doseQuantity: numerator.quantity,
      rateQuantity: denominator.quantity,
    };
  } else {
    return {
      doseQuantity: numerator.quantity,
    };
  }
}
