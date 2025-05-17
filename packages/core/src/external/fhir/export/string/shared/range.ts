import { Range } from "@medplum/fhirtypes";
import { formatQuantity } from "./quantity";
import { FIELD_SEPARATOR } from "./separator";

/**
 * Formats a FHIR Range value to a string representation
 * A Range consists of a low and high value, both of which are Quantities
 */
export const formatRange = (range: Range | undefined, label?: string): string | undefined => {
  if (!range) return undefined;

  const parts: string[] = [];

  const lowStr = formatQuantity(range.low, "Low");
  if (lowStr) parts.push(lowStr);

  const highStr = formatQuantity(range.high, "High");
  if (highStr) parts.push(highStr);

  if (parts.length < 1) return undefined;

  const formattedRange = parts.join(FIELD_SEPARATOR);
  return label ? `${label}: ${formattedRange}` : formattedRange;
};
