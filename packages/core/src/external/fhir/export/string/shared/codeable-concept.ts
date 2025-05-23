import { CodeableConcept } from "@medplum/fhirtypes";
import { codeAndDisplayToString } from "./code-display";
import { formatCoding, getCode } from "./coding";
import { defaultIsDebug } from "./debug";
import { emptyIfDenied, isAllowedSystem } from "./deny";
import { FIELD_SEPARATOR } from "./separator";
const SEP_BETWEEN_CODING = "/";
const SEP_BETWEEN_TEXT_AND_CODING = ":";

/**
 * Formats a single FHIR codeable concept into a string representation
 * @param concept - FHIR codeable concept to format
 * @param label - Label to prefix the formatted string with
 * @param skipInternalCodes - Whether to skip internal codes from 3rd party systems
 * @param isDebug - Whether to include the label in the output
 * @returns Formatted string of codeable concept
 */
export function formatCodeableConcept({
  concept,
  label,
  skipInternalCodes,
  isDebug = defaultIsDebug,
}: {
  concept: CodeableConcept | undefined;
  label?: string;
  skipInternalCodes?: boolean | undefined;
  isDebug?: boolean | undefined;
}): string | undefined {
  if (!concept) return undefined;

  const textPre = emptyIfDenied(concept.text);
  const text = textPre ? textPre.trim() : undefined;

  const emptyCode = "<!empty!>";
  const codingMap =
    concept.coding?.reduce((acc, cur) => {
      const system = isAllowedSystem(cur.system);
      if (!system) return acc;
      const code = getCode({ coding: cur, skipInternalCodes });
      const codeAndDisplay = formatCoding({ coding: cur, skipInternalCodes });
      if (code) {
        if (acc[code]) return acc;
        if (codeAndDisplay) {
          acc[code] = codeAndDisplay;
          return acc;
        }
      }
      const altCodeAndDisplay = codeAndDisplayToString(undefined, cur.display);
      if (!altCodeAndDisplay) return acc;
      if (acc[emptyCode]) acc[emptyCode] = acc[emptyCode] + "; " + altCodeAndDisplay;
      else acc[emptyCode] = altCodeAndDisplay;
      return acc;
    }, {} as Record<string, string>) ?? {};

  let codingStr = "";
  const values = Object.values(codingMap);
  const sortedValues = values.sort();
  for (const coding of sortedValues) {
    const separator = codingStr.length > 0 ? ` ${SEP_BETWEEN_CODING} ` : "";
    codingStr = codingStr + separator + coding;
  }

  if (!codingStr && !text) return undefined;
  if (!codingStr && text) return text;
  const labelStr = isDebug && label ? `${label}: ` : "";
  const textStr = text && !codingStr.includes(text) ? `${text}${SEP_BETWEEN_TEXT_AND_CODING} ` : "";
  return `${labelStr}${textStr}${codingStr}`;
}

/**
 * Formats a list of FHIR codeable concepts into a string representation
 * @param concepts - List of FHIR codeable concepts to format
 * @param label - Label to prefix the formatted string with
 * @param skipInternalCodes - Whether to skip internal codes from 3rd party systems
 * @param isDebug - Whether to include the label in the output
 * @returns Formatted string of codeable concepts
 */
export function formatCodeableConcepts({
  concepts,
  label,
  skipInternalCodes,
  isDebug = defaultIsDebug,
}: {
  concepts: CodeableConcept[] | undefined;
  label: string;
  skipInternalCodes?: boolean | undefined;
  isDebug?: boolean | undefined;
}): string | undefined {
  if (!concepts?.length) return undefined;
  const formattedConcepts = concepts
    .map(concept => formatCodeableConcept({ concept, skipInternalCodes, isDebug }))
    .filter(Boolean);
  if (formattedConcepts.length < 1) return undefined;
  const converted = formattedConcepts.join(FIELD_SEPARATOR);
  return isDebug ? `${label}: ${converted}` : converted;
}
