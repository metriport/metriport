import { CodeableConcept, Resource } from "@medplum/fhirtypes";

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
