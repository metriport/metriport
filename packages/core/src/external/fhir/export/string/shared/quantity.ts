import { Quantity } from "@medplum/fhirtypes";

/**
 * Formats a FHIR quantity into a string representation
 * @param quantity - FHIR quantity to format
 * @param label - Label to prefix the formatted string with
 * @returns Formatted string of quantity
 */
export function formatQuantity(quantity: Quantity | undefined, label?: string): string | undefined {
  const { value, unit } = quantity ?? {};
  if (!value) return undefined;
  const qttyString = `${value.toString()}${unit ? ` ${unit}` : ""}`;
  return label ? `${label}: ${qttyString}` : qttyString;
}
