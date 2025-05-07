import { Quantity } from "@medplum/fhirtypes";

/**
 * Formats a FHIR quantity into a string representation
 * @param quantity - FHIR quantity to format
 * @param label - Label to prefix the formatted string with
 * @returns Formatted string of quantity
 */
export function formatQuantity(quantity: Quantity | undefined, label: string): string {
  if (!quantity?.value) return "";

  return `${label}: ${quantity.value} ${quantity.unit ?? ""}`;
}
