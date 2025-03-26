import { CodeableConcept, Coding, Resource } from "@medplum/fhirtypes";
import { isUnknownCoding } from "../../fhir-deduplication/shared";
import { knownSystemUrls } from "../../util/constants";

export const unknownValues = ["unknown", "unk"];

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
  if (coding.display && isUsefulDisplay(coding.display)) return true;
  if (isUnknownCoding(coding)) return false;
  if (coding.system && knownSystemUrls.includes(coding.system)) return true;
  return false;
}

export function isUsefulDisplay(text: string) {
  const normalizedText = text.toLowerCase().trim();
  return (
    normalizedText.length > 0 &&
    !(unknownValues.includes(normalizedText) || normalizedText.includes("no data available"))
  );
}

export function findCodeableConcepts(resource: Resource): CodeableConcept[] {
  const codeableConcepts: CodeableConcept[] = [];
  for (const value of Object.values(resource)) {
    if (!value) continue;

    if (isCodeableConcept(value)) {
      codeableConcepts.push(value);
    } else if (Array.isArray(value)) {
      value.forEach(item => {
        if (isCodeableConcept(item)) {
          codeableConcepts.push(item);
        }
      });
    }
  }

  return codeableConcepts;
}

export function isCodeableConcept(value: unknown): value is CodeableConcept {
  return typeof value === "object" && value !== null && "coding" in value;
}
