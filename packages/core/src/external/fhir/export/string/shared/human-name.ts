import { HumanName } from "@medplum/fhirtypes";
import { FIELD_SEPARATOR } from "./separator";

const NAME_SEPARATOR = " ";

/**
 * Formats a FHIR human name into a string representation
 * @param names - List of FHIR human names to format
 * @returns Formatted string of human names
 */
export function formatHumanNames(
  names: HumanName[] | undefined,
  label?: string
): string | undefined {
  if (!names?.length) return "";

  const formattedNames = names.map(name => formatHumanName(name)).filter(Boolean);
  if (formattedNames.length < 1) return undefined;

  const formatted = formattedNames.join(FIELD_SEPARATOR);
  return label ? `${label}: ${formatted}` : formatted;
}

export function formatHumanName(name: HumanName | undefined, label?: string): string | undefined {
  if (!name) return undefined;

  const prefixes = name.prefix ? name.prefix.join(NAME_SEPARATOR) : undefined;
  const suffixes = name.suffix ? name.suffix.join(NAME_SEPARATOR) : undefined;
  const required = [name.given?.join(NAME_SEPARATOR), name.family].filter(Boolean);
  if (required.length < 1) return undefined;

  const merged = [prefixes, ...required, suffixes].filter(Boolean);
  if (merged.length < 1) return undefined;

  const formatted = merged.join(FIELD_SEPARATOR);
  return label ? `${label}: ${formatted}` : formatted;
}
