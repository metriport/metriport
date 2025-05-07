import { Identifier } from "@medplum/fhirtypes";

/**
 * Formats a list of FHIR identifiers into a string representation
 * @param identifiers - List of FHIR identifiers to format
 * @returns Formatted string of identifiers
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const formatIdentifiers = (identifiers: Identifier[] | undefined): string | undefined => {
  return undefined;
  // if (!identifiers?.length) return "";

  // const formattedIds = identifiers
  //   .map((id: Identifier) => `${id.value} (${id.system ?? "unknown"})`)
  //   .join(FIELD_SEPARATOR);

  // return `IDs (value/system): ${formattedIds}`;
};
