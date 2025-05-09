import { HumanName } from "@medplum/fhirtypes";
import { FIELD_SEPARATOR } from "./separator";

/**
 * Formats a FHIR human name into a string representation
 * @param names - List of FHIR human names to format
 * @returns Formatted string of human names
 */
export function formatHumanNames(names: HumanName[] | undefined): string {
  if (!names?.length) return "";

  const formattedNames = names
    .map(name => {
      const given = name.given?.join(" ") ?? "";
      const family = name.family ?? "";
      return `${given} ${family}`.trim();
    })
    .join(FIELD_SEPARATOR);

  return `Name: ${formattedNames}`;
}
