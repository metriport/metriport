import { Range } from "@medplum/fhirtypes";
import { defaultIsDebug } from "./debug";
import { formatQuantity } from "./quantity";
import { FIELD_SEPARATOR } from "./separator";

/**
 * Formats a FHIR Range value to a string representation
 * A Range consists of a low and high value, both of which are Quantities
 */
export function formatRange({
  range,
  label,
  isDebug = defaultIsDebug,
}: {
  range: Range | undefined;
  label?: string;
  isDebug?: boolean | undefined;
}): string | undefined {
  if (!range) return undefined;

  const parts: string[] = [];

  const lowStr = formatQuantity({ quantity: range.low, label: "Low", isDebug });
  if (lowStr) parts.push(lowStr);

  const highStr = formatQuantity({ quantity: range.high, label: "High", isDebug });
  if (highStr) parts.push(highStr);

  if (parts.length < 1) return undefined;

  const formattedRange = parts.join(FIELD_SEPARATOR);
  return isDebug && label ? `${label}: ${formattedRange}` : formattedRange;
}
