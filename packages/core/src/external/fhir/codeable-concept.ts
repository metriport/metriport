import { CodeableConcept, Coding, Resource } from "@medplum/fhirtypes";
import { isUnknownCoding } from "../../fhir-deduplication/shared";
import { knownSystemUrls } from "../../util/constants";

export const unknownValues = ["unknown", "unk", "no known"];

/**
 * Returns the code attribute from each resource based on its spec
 */
export function getCodesFromResource(res: Resource): CodeableConcept[] {
  if (
    res.resourceType === "DiagnosticReport" ||
    res.resourceType === "Medication" ||
    res.resourceType === "Condition" ||
    res.resourceType === "AllergyIntolerance" ||
    res.resourceType === "Procedure" ||
    res.resourceType === "Observation" ||
    res.resourceType === "ServiceRequest"
  ) {
    return res.code ? [res.code] : [];
  } else if (res.resourceType === "Immunization") {
    return res.vaccineCode ? [res.vaccineCode] : [];
  } else if (res.resourceType === "Practitioner") {
    return res.qualification ?? [];
  } else if (res.resourceType === "Encounter" || res.resourceType === "Location") {
    return res.type ?? [];
  } else if (res.resourceType === "Composition") {
    return res.type ? [res.type] : [];
  }
  return [];
}

export function isValidCoding(coding: Coding): boolean {
  if (coding.display && !isUselessDisplay(coding.display)) return true;
  if (isUnknownCoding(coding)) return false;
  if (coding.system && knownSystemUrls.includes(coding.system)) return true;
  return false;
}

export function isUselessDisplay(text: string) {
  const normalizedText = text.toLowerCase().trim();
  return (
    normalizedText.length === 0 ||
    unknownValues.includes(normalizedText) ||
    normalizedText.includes("no data available")
  );
}
