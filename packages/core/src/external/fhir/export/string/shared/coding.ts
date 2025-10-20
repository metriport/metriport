import { Coding } from "@medplum/fhirtypes";
import { codeAndDisplayToString } from "./code-display";
import { emptyIfDenied, isAllowedSystem } from "./deny";
import { FIELD_SEPARATOR } from "./separator";

const INTERNAL_CODE_SYSTEM = "urn:oid:1.2.840.";

/**
 * Formats a FHIR coding into a string representation
 * @param codings - List of FHIR codings to format
 * @param label - Label to prefix the formatted string with
 * @param skipInternalCodes - Whether to skip internal codes from 3rd party systems
 * @param isDebug - Whether to include the label in the output
 * @returns Formatted string of coding
 */
export function formatCodings({
  codings,
  label,
  skipInternalCodes,
  isDebug = false,
}: {
  codings: Coding[] | undefined;
  label: string;
  skipInternalCodes?: boolean | undefined;
  isDebug?: boolean | undefined;
}): string | undefined {
  if (!codings) return undefined;
  const formattedCodings = codings
    .map(coding => formatCoding({ coding, skipInternalCodes }))
    .filter(Boolean);
  if (formattedCodings.length < 1) return undefined;
  const formatted = formattedCodings.join(FIELD_SEPARATOR);
  return isDebug && label ? `${label}: ${formatted}` : formatted;
}

/**
 * Formats a FHIR coding into a string representation
 * @param coding - FHIR coding to format
 * @param skipInternalCodes - Whether to skip internal codes from 3rd party systems
 * @returns Formatted string of coding
 */
export function formatCoding({
  coding,
  skipInternalCodes,
}: {
  coding: Coding | undefined;
  skipInternalCodes?: boolean | undefined;
}): string | undefined {
  if (!coding) return undefined;
  if (skipInternalCodes && isInternalCoding(coding)) return undefined;

  const system = isAllowedSystem(coding.system);
  if (!system) return undefined;
  const code = getCode({ coding, skipInternalCodes });
  const displayPre = emptyIfDenied(coding.display);
  const display = displayPre ? displayPre.trim() : undefined;

  if (code) return codeAndDisplayToString(code, display);

  const altCode = "";
  const codeAndDisplay = codeAndDisplayToString(altCode, coding.display);
  if (!codeAndDisplay) return undefined;

  return codeAndDisplay;
}

/**
 * Gets the code from a FHIR coding
 * @param coding - FHIR coding to get the code from
 * @param skipInternalCodes - Whether to skip internal codes from 3rd party systems
 * @returns Code from the coding
 */
export function getCode({
  coding,
  skipInternalCodes = false,
}: {
  coding: Coding;
  skipInternalCodes?: boolean | undefined;
}): string | undefined {
  const codePre = emptyIfDenied(coding.code);
  const code = codePre ? codePre.trim() : undefined;
  if (skipInternalCodes && isInternalCoding(coding)) return undefined;
  return code;
}

function isInternalCoding(coding: Coding): boolean {
  return coding.system?.startsWith(INTERNAL_CODE_SYSTEM) ?? false;
}
