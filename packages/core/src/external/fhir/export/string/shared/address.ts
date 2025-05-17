import { Address } from "@medplum/fhirtypes";
import { FIELD_SEPARATOR } from "./separator";

/**
 * Formats a FHIR address into a string representation
 * @param addresses - List of FHIR addresses to format
 * @returns Formatted string of addresses
 */
export function formatAddresses(
  addresses: Address[] | undefined,
  label?: string
): string | undefined {
  if (!addresses?.length) return undefined;
  const formattedAddresses = addresses.map(a => formatAddress(a)).filter(Boolean);
  if (formattedAddresses.length < 1) return undefined;

  const formatted = formattedAddresses.join(FIELD_SEPARATOR);
  return label ? `${label}: ${formatted}` : formatted;
}

export function formatAddress(address: Address | undefined, label?: string): string | undefined {
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
  return label ? `${label}: ${formatted}` : formatted;
}
