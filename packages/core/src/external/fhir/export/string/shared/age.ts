import { Age } from "@medplum/fhirtypes";
import { formatQuantity } from "./quantity";

/**
 * Formats a FHIR Age value to a string representation
 * Age is a special case of Quantity where the unit is a time unit and the system is UCUM
 */
export function formatAge({
  age,
  label,
  isDebug,
}: {
  age: Age | undefined;
  label?: string | undefined;
  isDebug?: boolean | undefined;
}): string | undefined {
  return formatQuantity({ quantity: age, label, isDebug });
}
