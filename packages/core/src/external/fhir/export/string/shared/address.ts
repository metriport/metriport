import { Address } from "@medplum/fhirtypes";
import { defaultIsDebug } from "./debug";
import { FIELD_SEPARATOR } from "./separator";
/**
 * Formats a FHIR address into a string representation
 * @param addresses - List of FHIR addresses to format
 * @param label - Label to prefix the formatted string with
 * @param isDebug - Whether to include the label in the output
 * @returns Formatted string of addresses
 */
export function formatAddresses({
  addresses,
  label,
  isDebug = defaultIsDebug,
}: {
  addresses: Address[] | undefined;
  label?: string;
  isDebug?: boolean | undefined;
}): string | undefined {
  if (!addresses?.length) return undefined;
  const formattedAddresses = addresses.flatMap(
    address => formatAddress({ address, isDebug }) ?? []
  );
  if (formattedAddresses.length < 1) return undefined;
  const formatted = formattedAddresses.join(FIELD_SEPARATOR);
  return isDebug && label ? `${label}: ${formatted}` : formatted;
}

export function formatAddress({
  address,
  label,
  isDebug = defaultIsDebug,
}: {
  address: Address | undefined;
  label?: string;
  isDebug?: boolean | undefined;
}): string | undefined {
  if (!address) return undefined;
  const components = [
    address.line?.join(FIELD_SEPARATOR),
    address.city,
    address.state,
    address.postalCode,
    // address.country,
  ].filter(Boolean);
  if (components.length < 1) return undefined;

  const formatted = [...components, address.text].filter(Boolean).join(FIELD_SEPARATOR);
  return isDebug && label ? `${label}: ${formatted}` : formatted;
}
