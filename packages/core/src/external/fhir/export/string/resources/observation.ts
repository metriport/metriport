import { Observation, ObservationReferenceRange } from "@medplum/fhirtypes";
import { FHIRResourceToString } from "../fhir-resource-to-string";
import { formatCodeableConcept, formatCodeableConcepts } from "../shared/codeable-concept";
import { formatIdentifiers } from "../shared/identifier";
import { formatQuantity } from "../shared/quantity";
import { formatReferences } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR Observation resource to a string representation
 */
export class ObservationToString implements FHIRResourceToString<Observation> {
  toString(observation: Observation): string {
    const parts: string[] = [];

    const identifierStr = formatIdentifiers(observation.identifier);
    if (identifierStr) {
      parts.push(identifierStr);
    }

    if (observation.status) parts.push(`Status: ${observation.status}`);

    const categoryStr = formatCodeableConcepts(observation.category, "Category");
    if (categoryStr) {
      parts.push(categoryStr);
    }

    const codeStr = formatCodeableConcept(observation.code, "Code");
    if (codeStr) {
      parts.push(codeStr);
    }

    const valueStr = formatQuantity(observation.valueQuantity, "Value");
    if (valueStr) {
      parts.push(valueStr);
    }

    const referenceRangeStr = observation.referenceRange
      ?.map((rr: ObservationReferenceRange) => {
        const lowStr = formatQuantity(rr.low, "Low");
        const highStr = formatQuantity(rr.high, "High");
        return [lowStr, highStr].filter(Boolean).join(FIELD_SEPARATOR);
      })
      .join(FIELD_SEPARATOR);
    if (referenceRangeStr) {
      parts.push(`Reference Range: ${referenceRangeStr}`);
    }

    const valueCodeableConceptStr = formatCodeableConcept(
      observation.valueCodeableConcept,
      "Value"
    );
    if (valueCodeableConceptStr) {
      parts.push(valueCodeableConceptStr);
    }

    const interpretationStr = formatCodeableConcepts(observation.interpretation, "Interpretation");
    if (interpretationStr) {
      parts.push(interpretationStr);
    }

    if (observation.effectiveDateTime) parts.push(`Effective: ${observation.effectiveDateTime}`);

    if (observation.issued) parts.push(`Issued: ${observation.issued}`);

    const performerStr = formatReferences(observation.performer, "Performer");
    if (performerStr) {
      parts.push(performerStr);
    }

    return parts.join(FIELD_SEPARATOR);
  }
}
