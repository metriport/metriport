import { Address } from "@medplum/fhirtypes";
import { FIELD_SEPARATOR } from "./separator";

/**
 * Formats a FHIR address into a string representation
 * @param addresses - List of FHIR addresses to format
 * @returns Formatted string of addresses
 */
export function formatAddresses(addresses: Address[] | undefined): string {
  if (!addresses?.length) return "";

  const formattedAddresses = addresses
    .map(addr => {
      const components = [
        addr.line?.join(", "),
        addr.city,
        addr.state,
        addr.postalCode,
        addr.country,
      ].filter(Boolean);
      return components.join(", ");
    })
    .join(FIELD_SEPARATOR);

  return `Address: ${formattedAddresses}`;
}
