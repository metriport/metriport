import { Coding } from "@medplum/fhirtypes";
import { codeAndDisplayToString } from "./code-display";
import { emptyIfDenied, isAllowedSystem } from "./deny";
import { FIELD_SEPARATOR } from "./separator";

export function formatCodings(codings: Coding[] | undefined, label: string): string | undefined {
  if (!codings) return undefined;
  const codingsStr = codings.map(formatCoding).filter(Boolean);
  if (codingsStr.length < 1) return undefined;
  const formattedCodings = codingsStr.join(FIELD_SEPARATOR);
  return label ? `${label}: ${formattedCodings}` : formattedCodings;
}

export function formatCoding(coding: Coding | undefined): string | undefined {
  if (!coding) return undefined;

  const system = isAllowedSystem(coding.system);
  if (!system) return undefined;
  const code = getCode(coding);
  const displayPre = emptyIfDenied(coding.display);
  const display = displayPre ? displayPre.trim() : undefined;

  if (code) return codeAndDisplayToString(code, display);

  const altCode = "";
  const codeAndDisplay = codeAndDisplayToString(altCode, coding.display);
  if (!codeAndDisplay) return undefined;

  return codeAndDisplay;
}

export function getCode(coding: Coding): string | undefined {
  const codePre = emptyIfDenied(coding.code);
  const code = codePre ? codePre.trim() : undefined;
  return code;
}
