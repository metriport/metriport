import { Quantity } from "@medplum/fhirtypes";
import { defaultIsDebug } from "./debug";

/**
 * Formats a FHIR quantity into a string representation
 * @param quantity - FHIR quantity to format
 * @param label - Label to prefix the formatted string with
 * @param isDebug - Whether to include the label in the output
 * @returns Formatted string of quantity
 */
export function formatQuantity({
  quantity,
  label,
  isDebug = defaultIsDebug,
}: {
  quantity: Quantity | undefined;
  label?: string | undefined;
  isDebug?: boolean | undefined;
}): string | undefined {
  const { value, unit } = quantity ?? {};
  if (!value) return undefined;
  const qttyString = `${value.toString()}${unit ? ` ${unit}` : ""}`;
  return isDebug && label ? `${label}: ${qttyString}` : qttyString;
}
