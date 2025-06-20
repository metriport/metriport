import { Identifier } from "@medplum/fhirtypes";
import { uniq } from "lodash";
import { FIELD_SEPARATOR } from "./separator";

export function formatIdentifiers({
  identifiers,
  systemsToInclude,
}: {
  identifiers: Identifier[] | undefined;
  systemsToInclude?: string[] | undefined;
}): string | undefined {
  if (!identifiers) return undefined;
  const formatted = identifiers.flatMap(
    identifier => formatIdentifier({ identifier, systemsToInclude }) ?? []
  );
  const deduped = uniq(formatted);
  if (!deduped || deduped.length < 1) return undefined;
  return deduped.join(FIELD_SEPARATOR);
}

/**
 * Formats an identifier based on its value. If "systemsToInclude" is provided, it will only format
 * the identifier if at least one of the systems matches any of the strings in the systemsToInclude
 * array, returning undefined otherwise.
 *
 * @param id - The identifier to format
 * @param systemsToInclude - The systems to filter by (partial match, optional - defaults to no filtering)
 * @returns The formatted identifier or undefined if no value could be formatted
 */
export function formatIdentifier({
  identifier,
  systemsToInclude,
}: {
  identifier: Identifier | undefined;
  systemsToInclude?: string[] | undefined;
}): string | undefined {
  if (!identifier?.value) return undefined;
  const value = String(identifier.value).trim();
  if (!value) return undefined;
  if (systemsToInclude && !systemsToInclude.some(system => identifier.system?.includes(system))) {
    return undefined;
  }
  return value;
}

/**
 * Format identifiers that are NPI identifiers. Doesn't include identifiers that are not NPI.
 *
 * @param identifiers - The identifiers to format
 * @returns The formatted identifiers or undefined if no value could be formatted
 */
export function formatNpiIdentifiers({
  identifiers,
}: {
  identifiers: Identifier[] | undefined;
}): string | undefined {
  return formatIdentifiers({ identifiers, systemsToInclude: ["npi"] });
}
