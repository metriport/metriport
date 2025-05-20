import { HumanName } from "@medplum/fhirtypes";
import { uniq } from "lodash";
import { FIELD_SEPARATOR } from "./separator";
import { defaultIsDebug } from "./debug";
const NAME_SEPARATOR = " ";

/**
 * Formats a FHIR human name into a string representation
 * @param names - List of FHIR human names to format
 * @param label - Label to prefix the formatted string with
 * @param isDebug - Whether to include the label in the output
 * @returns Formatted string of human names
 */
export function formatHumanNames({
  names,
  label,
  isDebug = defaultIsDebug,
}: {
  names: HumanName[] | undefined;
  label?: string;
  isDebug?: boolean | undefined;
}): string | undefined {
  if (!names || names.length < 1) return undefined;

  const formattedNames = names.map(name => formatHumanName({ name, isDebug })).filter(Boolean);
  const dedupedNames = uniq(formattedNames);
  if (dedupedNames.length < 1) return undefined;

  const formatted = dedupedNames.join(FIELD_SEPARATOR);
  return isDebug && label ? `${label}: ${formatted}` : formatted;
}

export function formatHumanName({
  name,
  label,
  isDebug = defaultIsDebug,
}: {
  name: HumanName | undefined;
  label?: string;
  isDebug?: boolean | undefined;
}): string | undefined {
  if (!name) return undefined;

  const prefixes = name.prefix ? name.prefix.join(NAME_SEPARATOR) : undefined;
  const suffixes = name.suffix ? name.suffix.join(NAME_SEPARATOR) : undefined;
  const required = [name.given?.join(NAME_SEPARATOR), name.family].filter(Boolean);
  if (required.length < 1) return undefined;

  const merged = [prefixes, ...required, suffixes].filter(Boolean);
  if (merged.length < 1) return undefined;

  const formatted = merged.join(FIELD_SEPARATOR);
  return isDebug && label ? `${label}: ${formatted}` : formatted;
}
