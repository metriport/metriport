import { Ratio } from "@medplum/fhirtypes";
import { defaultIsDebug } from "./debug";
import { formatQuantity } from "./quantity";
import { FIELD_SEPARATOR } from "./separator";

/**
 * Formats a FHIR Ratio value to a string representation
 * A Ratio consists of a numerator and a denominator, both of which are Quantities
 */
export function formatRatio({
  ratio,
  label,
  isDebug = defaultIsDebug,
}: {
  ratio: Ratio | undefined;
  label?: string;
  isDebug?: boolean | undefined;
}): string | undefined {
  if (!ratio) return undefined;

  const parts: string[] = [];

  const numeratorStr = formatQuantity({ quantity: ratio.numerator, label: "Numerator", isDebug });
  if (numeratorStr) parts.push(numeratorStr);

  const denominatorStr = formatQuantity({
    quantity: ratio.denominator,
    label: "Denominator",
    isDebug,
  });
  if (denominatorStr) parts.push(denominatorStr);

  if (parts.length < 1) return undefined;

  const formattedRatio = parts.join(FIELD_SEPARATOR);
  return isDebug && label ? `${label}: ${formattedRatio}` : formattedRatio;
}
